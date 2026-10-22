const hre = require("hardhat");

async function main() {
  console.log(`Deploying ManuscriptRegistry to network: ${hre.network.name}...`);

  const Registry = await hre.ethers.getContractFactory("ManuscriptRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`\nManuscriptRegistry deployed to: ${address}`);

  if (hre.network.name === "sepolia") {
    console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  }
  console.log(`\nNext step: put this address in backend/.env as CONTRACT_ADDRESS`);
  console.log(`and in frontend as VITE_CONTRACT_ADDRESS (see the frontend .env.example).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
