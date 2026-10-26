import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * 部署 Escrow
 * 仲裁人：先用你自己的 Account 2（单人/两人组模拟）。
 * 若助教或组员给了仲裁地址，把下面常量改成那个地址再重新部署。
 */
const ARBITER = "0xb520E3fe988eb166DbF7F99bB9F2A565A5Ab71ce";

const deployEscrow: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("Escrow", {
    from: deployer,
    args: [ARBITER],
    log: true,
    autoMine: true,
  });
};

deployEscrow.tags = ["EscrowLZY202430551035"];

export default deployEscrow;
