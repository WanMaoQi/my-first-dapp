# 区块链技术与应用 · 大作业（路线 B）

学号：202430551035  
姓名：龙泽宇  
路线：**B（用户前端）** — `packages/nextjs/app/escrow/page.tsx`

## 合约地址（POTOS Testnet）

| 项目 | 地址 |
|------|------|
| Escrow | `0xD5223DA40De2c915cC79195a721515cA853E9560` |
| LZYToken | `0xfA5F179570A30c94539c99A888a51AB8f3241244` |
| 仲裁人（Account2） | `0xb520E3fe988eb166DbF7F99bB9F2A565A5Ab71ce` |
| 买家（Account1） | `0x15d79fd10850f52f2e769A7FAEf271E8ff4b1646` |

区块浏览器：https://scan-testnet.potos.hk/

## 环境变量

- **不要把私钥写进仓库。**
- Hardhat 部署如需私钥：仅通过本机环境变量 / `.env`（已在 `.gitignore`）注入，例如课程要求的 deployer 私钥变量。
- 前端路线 B **不需要**在服务器保存私钥；用户用 MetaMask 签名。

## 如何运行

```bash
cd my-first-dapp
yarn install
yarn start
```

浏览器打开终端提示的地址（WSL 下常用 `http://<WSL-IP>:3000`），进入顶栏 **Escrow** 或路径 `/escrow`。  
MetaMask 网络选 **POTOS Testnet (60600)**。

## 交易记录表（路线 B）

| 操作 | 交易哈希 | 浏览器 | 发起账户 |
|------|----------|--------|----------|
| 部署 Escrow | `0x77bae0c1da6f50837547e8681ed5dc26700e33824481ca4cdf7e472e8352f509` | [链接](https://scan-testnet.potos.hk/tx/0x77bae0c1da6f50837547e8681ed5dc26700e33824481ca4cdf7e472e8352f509) | Account1 |
| createOrder 订单0（链上 id=2） | `0x24325ff8eb127b9e6d801afaa79761c4ed4bce6200c0f867846a7fb361d6a609` | [链接](https://scan-testnet.potos.hk/tx/0x24325ff8eb127b9e6d801afaa79761c4ed4bce6200c0f867846a7fb361d6a609) | Account1 |
| approve | `0x1cfbb948c5650bbae5a6f505d375b8e3960153ebfbffe3f3ab83c1a0edf79c1d` | [链接](https://scan-testnet.potos.hk/tx/0x1cfbb948c5650bbae5a6f505d375b8e3960153ebfbffe3f3ab83c1a0edf79c1d) | Account1 |
| deposit 订单0 | `0x0ac8606fb6bc5e2cbde92346d7ddcf55562473e59bda2cc440399d823a274a63` | [链接](https://scan-testnet.potos.hk/tx/0x0ac8606fb6bc5e2cbde92346d7ddcf55562473e59bda2cc440399d823a274a63) | Account1 |
| dispute 订单1（链上 id=3） | `0x949a1a3d484907682ba3181a1957f320ae234017da196832ce76146a4ba34a2d` | [链接](https://scan-testnet.potos.hk/tx/0x949a1a3d484907682ba3181a1957f320ae234017da196832ce76146a4ba34a2d) | Account2 |
| resolve 订单1 | `0x1caaaa6e7cad51b125311a19a59f0f9491bb17061859f5fe1d3cf1befe0df0ef` | [链接](https://scan-testnet.potos.hk/tx/0x1caaaa6e7cad51b125311a19a59f0f9491bb17061859f5fe1d3cf1befe0df0ef) | Account2 |
| confirm 订单0 | `0x6724de6b9710e66d9c72e642a07e7541e3bed908eec49b4402dca6b1315dae8e` | [链接](https://scan-testnet.potos.hk/tx/0x6724de6b9710e66d9c72e642a07e7541e3bed908eec49b4402dca6b1315dae8e) | Account1 |

说明：表头「订单 0/1」对应验收流程两笔业务；链上订单 id 分别为 2 与 3（0/1 为实验 3 旧单）。

## 仓库

https://github.com/WanMaoQi/my-first-dapp
