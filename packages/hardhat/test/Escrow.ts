import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Escrow", function () {
  const AMOUNT = ethers.parseEther("30");

  async function deployFixture() {
    const [deployer, buyer, seller, arbiter, stranger] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("LZYToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(arbiter.address);
    await escrow.waitForDeployment();

    await token.mint(buyer.address, ethers.parseEther("100"));

    return { token, escrow, deployer, buyer, seller, arbiter, stranger };
  }

  async function createPaidOrder(
    token: Awaited<ReturnType<typeof deployFixture>>["token"],
    escrow: Awaited<ReturnType<typeof deployFixture>>["escrow"],
    buyer: Awaited<ReturnType<typeof deployFixture>>["buyer"],
    seller: Awaited<ReturnType<typeof deployFixture>>["seller"],
  ) {
    const deadline = (await time.latest()) + 3600;
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "lab3");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);
    return deadline;
  }

  it("createOrder 创建订单并发事件", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + 3600;
    const tokenAddr = await token.getAddress();

    await expect(escrow.connect(buyer).createOrder(seller.address, tokenAddr, AMOUNT, deadline, "lab3"))
      .to.emit(escrow, "OrderCreated")
      .withArgs(0, buyer.address, seller.address, tokenAddr, AMOUNT, deadline);

    const o = await escrow.getOrder(0);
    expect(o.buyer).to.equal(buyer.address);
    expect(o.seller).to.equal(seller.address);
    expect(o.amount).to.equal(AMOUNT);
    expect(o.status).to.equal(0);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + 3600;
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "lab3");

    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("insufficient allowance");
  });

  it("approve 后 deposit 成功，状态变为 Paid", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + 3600;
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "lab3");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await expect(escrow.connect(buyer).deposit(0)).to.emit(escrow, "OrderPaid").withArgs(0);

    const o = await escrow.getOrder(0);
    expect(o.status).to.equal(1);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
  });

  it("非买家调用 confirm 失败", async function () {
    const { token, escrow, buyer, seller, stranger } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);

    await expect(escrow.connect(stranger).confirm(0)).to.be.revertedWith("Escrow: not buyer");
  });

  it("confirm 成功，状态变为 Completed，卖家收到代币", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);
    const before = await token.balanceOf(seller.address);

    await expect(escrow.connect(buyer).confirm(0)).to.emit(escrow, "OrderCompleted").withArgs(0);

    const o = await escrow.getOrder(0);
    expect(o.status).to.equal(2);
    expect(await token.balanceOf(seller.address)).to.equal(before + AMOUNT);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
  });

  it("deadline 前 refund 失败", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);

    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: too early");
  });

  it("deadline 后 refund 成功，状态变为 Refunded", async function () {
    const { token, escrow, buyer, seller } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);
    await time.increase(3601);
    const before = await token.balanceOf(buyer.address);

    await expect(escrow.connect(buyer).refund(0)).to.emit(escrow, "OrderRefunded").withArgs(0);

    const o = await escrow.getOrder(0);
    expect(o.status).to.equal(3);
    expect(await token.balanceOf(buyer.address)).to.equal(before + AMOUNT);
  });

  it("非仲裁人调用 resolve 失败", async function () {
    const { token, escrow, buyer, seller, stranger } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);
    await escrow.connect(buyer).dispute(0);

    await expect(escrow.connect(stranger).resolve(0, true)).to.be.revertedWith("Escrow: not arbiter");
  });

  it("dispute 后仲裁人 resolve(false) 退款给买家，状态变为 Refunded", async function () {
    const { token, escrow, buyer, seller, arbiter } = await loadFixture(deployFixture);
    await createPaidOrder(token, escrow, buyer, seller);
    await escrow.connect(seller).dispute(0);
    const before = await token.balanceOf(buyer.address);

    await expect(escrow.connect(arbiter).resolve(0, false)).to.emit(escrow, "OrderResolved").withArgs(0, false);

    const o = await escrow.getOrder(0);
    expect(o.status).to.equal(3);
    expect(await token.balanceOf(buyer.address)).to.equal(before + AMOUNT);
  });
});
