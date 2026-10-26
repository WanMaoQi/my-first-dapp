import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * 部署实验二代币 LZYToken
 * Tag 用：姓名缩写 + 学号
 */
const deployToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("LZYToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

deployToken.tags = ["TokenLZY202430551035"];

export default deployToken;
