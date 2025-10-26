import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEHighScoreGame = await deploy("FHEHighScoreGame", {
    from: deployer,
    log: true,
  });

  console.log(`FHEHighScoreGame contract: `, deployedFHEHighScoreGame.address);
};
export default func;
func.id = "deploy_FHEHighScoreGame"; // id required to prevent reexecution
func.tags = ["FHEHighScoreGame"];
