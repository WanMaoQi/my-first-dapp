"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const STATUS = ["Created", "Paid", "Completed", "Refunded", "Disputed"] as const;
const STATUS_CN: Record<(typeof STATUS)[number], string> = {
  Created: "Created 待付款",
  Paid: "Paid 已付款",
  Completed: "Completed 已完成",
  Refunded: "Refunded 已退款",
  Disputed: "Disputed 争议中",
};

type OrderTuple = {
  buyer: Address;
  seller: Address;
  token: Address;
  amount: bigint;
  deadline: bigint;
  status: number | bigint;
  description: string;
};

function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function statusText(s: number | bigint | undefined) {
  const n = Number(s ?? 0);
  const key = STATUS[n] ?? "Created";
  return STATUS_CN[key] ?? String(n);
}

function OrderRow({
  id,
  address,
  arbiter,
  escrowAddress,
  writeEscrow,
  writeToken,
}: {
  id: bigint;
  address?: Address;
  arbiter?: Address;
  escrowAddress?: Address;
  writeEscrow: ReturnType<typeof useScaffoldWriteContract<"Escrow">>["writeContractAsync"];
  writeToken: ReturnType<typeof useScaffoldWriteContract<"LZYToken">>["writeContractAsync"];
}) {
  const [busy, setBusy] = useState(false);
  const { data: order, refetch } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [id],
  });

  const o = order as OrderTuple | undefined;
  const statusNum = o ? Number(o.status) : -1;
  const isBuyer = Boolean(address && o && address.toLowerCase() === o.buyer.toLowerCase());
  const isSeller = Boolean(address && o && address.toLowerCase() === o.seller.toLowerCase());
  const isArbiter = Boolean(address && arbiter && address.toLowerCase() === arbiter.toLowerCase());

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      setBusy(true);
      await fn();
      notification.success(okMsg);
      await refetch();
    } catch (e: any) {
      console.error(e);
      notification.error(e?.shortMessage || e?.message || "交易失败");
    } finally {
      setBusy(false);
    }
  };

  const onPay = async () => {
    if (!o || !escrowAddress) return;
    await run(async () => {
      // 第 1 笔：approve。必须等上链确认后再发 deposit，否则会报 allowance 不足
      notification.info(`订单 ${id.toString()}：请确认第 1 次弹窗（approve）…`);
      await writeToken(
        {
          functionName: "approve",
          args: [escrowAddress, o.amount],
        },
        { blockConfirmations: 1 },
      );
      // 第 2 笔：deposit
      notification.info(`订单 ${id.toString()}：请确认第 2 次弹窗（deposit）…`);
      await writeEscrow(
        {
          functionName: "deposit",
          args: [id],
        },
        { blockConfirmations: 1 },
      );
    }, `订单 ${id.toString()} 付款成功`);
  };

  if (!o) {
    return (
      <tr>
        <td colSpan={7} className="opacity-60">
          订单 #{id.toString()} 读取中…
        </td>
      </tr>
    );
  }

  const deadlineDate = new Date(Number(o.deadline) * 1000).toLocaleString();

  return (
    <tr className="border-b border-base-300">
      <td className="font-mono">{id.toString()}</td>
      <td className="font-mono text-xs" title={o.buyer}>
        {shortAddr(o.buyer)}
      </td>
      <td className="font-mono text-xs" title={o.seller}>
        {shortAddr(o.seller)}
      </td>
      <td>{formatUnits(o.amount, 18)}</td>
      <td className="text-xs whitespace-nowrap">{deadlineDate}</td>
      <td className="max-w-[10rem] truncate" title={o.description}>
        {o.description}
      </td>
      <td>{statusText(o.status)}</td>
      <td className="space-x-1 whitespace-nowrap">
        {isBuyer && statusNum === 0 && (
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={onPay}>
            付款
          </button>
        )}
        {isBuyer && statusNum === 1 && (
          <button
            className="btn btn-sm btn-success"
            disabled={busy}
            onClick={() => run(() => writeEscrow({ functionName: "confirm", args: [id] }), "确认收货成功")}
          >
            确认收货
          </button>
        )}
        {(isBuyer || isSeller) && statusNum === 1 && (
          <button
            className="btn btn-sm btn-warning"
            disabled={busy}
            onClick={() => run(() => writeEscrow({ functionName: "dispute", args: [id] }), "已发起争议")}
          >
            争议
          </button>
        )}
        {isBuyer && statusNum === 1 && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={busy}
            onClick={() => run(() => writeEscrow({ functionName: "refund", args: [id] }), "退款成功（需已过期）")}
            title="仅 deadline 之后才会成功"
          >
            超期退款
          </button>
        )}
        {isArbiter && statusNum === 4 && (
          <>
            <button
              className="btn btn-sm btn-accent"
              disabled={busy}
              onClick={() => run(() => writeEscrow({ functionName: "resolve", args: [id, true] }), "已判给卖家")}
            >
              判给卖家
            </button>
            <button
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => run(() => writeEscrow({ functionName: "resolve", args: [id, false] }), "已退给买家")}
            >
              退给买家
            </button>
          </>
        )}
        {!isBuyer && !isSeller && !(isArbiter && statusNum === 4) && statusNum !== 0 && (
          <span className="text-xs opacity-50">无</span>
        )}
      </td>
    </tr>
  );
}

export default function EscrowPage() {
  const { address } = useAccount();
  const { data: escrowInfo } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: tokenInfo } = useDeployedContractInfo({ contractName: "LZYToken" });

  const { data: arbiter } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "arbiter",
  });

  // 列表用 orderCount 生成 id（与 OrderCreated 的 id 一一对应）。
  // POTOS 的 eth_getLogs 每次只能扫 10 个块，从部署块扫到最新太慢，页面会一直空。
  const { data: orderCount, refetch: refetchCount } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "orderCount",
  });

  // 仍拉取事件作对照（后台慢慢扫）；列表不依赖它是否扫完
  const { data: created, isLoading: eventsLoading } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    watch: true,
    blocksBatchSize: 10,
  });

  const { writeContractAsync: writeEscrow } = useScaffoldWriteContract({ contractName: "Escrow" });
  const { writeContractAsync: writeToken } = useScaffoldWriteContract({ contractName: "LZYToken" });

  const orderIds = useMemo(() => {
    const n = Number(orderCount ?? 0);
    if (!Number.isFinite(n) || n <= 0) return [] as bigint[];
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [orderCount]);

  const eventIdsLoaded = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of created || []) {
      const id = (ev as any)?.args?.id as bigint | undefined;
      if (id !== undefined) ids.add(id.toString());
    }
    return ids.size;
  }, [created]);

  const [seller, setSeller] = useState("0xb520E3fe988eb166DbF7F99bB9F2A565A5Ab71ce");
  const [amountHuman, setAmountHuman] = useState("30");
  const [minutes, setMinutes] = useState("30");
  const [description, setDescription] = useState("页面订单");
  const [creating, setCreating] = useState(false);

  const roleHint = useMemo(() => {
    if (!address) return "未连接钱包";
    const parts: string[] = [];
    if (arbiter && address.toLowerCase() === String(arbiter).toLowerCase()) {
      parts.push("仲裁人");
    }
    // 粗略提示：具体每行订单角色看操作列
    parts.push("按下方订单行判断买家/卖家/旁观者");
    return parts.join("；");
  }, [address, arbiter]);

  const onCreate = async () => {
    try {
      if (!tokenInfo?.address) {
        notification.error("未找到 LZYToken 地址");
        return;
      }
      if (!seller.startsWith("0x") || seller.length !== 42) {
        notification.error("卖家地址格式不对（只要 0x 开头的地址）");
        return;
      }
      const amount = parseUnits(amountHuman || "0", 18);
      if (amount <= 0n) {
        notification.error("金额必须大于 0");
        return;
      }
      const mins = Number(minutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        notification.error("到期分钟数必须大于 0");
        return;
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.floor(mins * 60));
      setCreating(true);
      await writeEscrow({
        functionName: "createOrder",
        args: [seller as Address, tokenInfo.address, amount, deadline, description || "页面订单"],
      });
      await refetchCount();
      notification.success("创建订单成功");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.shortMessage || e?.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">托管交易</h1>
      <div className="bg-base-200 rounded-xl p-4 mb-6 space-y-1 text-sm">
        <p>
          <span className="opacity-70">当前账户：</span>
          <span className="font-mono">{address ?? "未连接"}</span>
        </p>
        <p>
          <span className="opacity-70">仲裁人：</span>
          <span className="font-mono">{arbiter ? String(arbiter) : "读取中…"}</span>
        </p>
        <p>
          <span className="opacity-70">你的角色：</span>
          {roleHint}
        </p>
        <p>
          <span className="opacity-70">订单总数（orderCount）：</span>
          {orderIds.length}
          <span className="opacity-50 text-xs ml-2">
            （事件已扫到 {eventIdsLoaded} 条{eventsLoading ? "，仍在后台拉取…" : ""}）
          </span>
        </p>
        <p className="opacity-70 text-xs">
          Escrow：{escrowInfo?.address ?? "-"} ／ LZYToken：{tokenInfo?.address ?? "-"}
        </p>
        <p className="text-xs opacity-60">
          一人模拟：Account1 当买家；Account2（仲裁人）当卖家。创建时 seller 填 Account2；争议后用 Account2
          点仲裁。合约要求买卖双方地址不能相同。
        </p>
      </div>

      <div className="card bg-base-100 shadow-md mb-8">
        <div className="card-body">
          <h2 className="card-title">创建订单</h2>
          <label className="form-control w-full">
            <span className="label-text">卖家地址 seller（不要填文字）</span>
            <input
              className="input input-bordered font-mono text-sm"
              value={seller}
              onChange={e => setSeller(e.target.value.trim())}
              placeholder="0x..."
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">金额（个，页面自动×10¹⁸）</span>
              <input
                className="input input-bordered"
                value={amountHuman}
                onChange={e => setAmountHuman(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">多少分钟后到期</span>
              <input className="input input-bordered" value={minutes} onChange={e => setMinutes(e.target.value)} />
            </label>
          </div>
          <label className="form-control">
            <span className="label-text">描述</span>
            <input
              className="input input-bordered"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
          <button className="btn btn-primary mt-2" disabled={creating || !address} onClick={onCreate}>
            {creating ? "提交中…" : "创建订单"}
          </button>
          <p className="text-xs opacity-60">金额按 18 位精度换算；截止时间按当前时间加分钟数换算成时间戳。</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-3">订单列表</h2>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>买家</th>
              <th>卖家</th>
              <th>金额</th>
              <th>截止</th>
              <th>描述</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orderIds.length === 0 && (
              <tr>
                <td colSpan={8} className="opacity-60">
                  暂无订单。可在本页点「创建订单」，或到 Debug 创建后刷新本页。
                </td>
              </tr>
            )}
            {orderIds.map(id => (
              <OrderRow
                key={id.toString()}
                id={id}
                address={address}
                arbiter={arbiter as Address | undefined}
                escrowAddress={escrowInfo?.address}
                writeEscrow={writeEscrow}
                writeToken={writeToken}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
