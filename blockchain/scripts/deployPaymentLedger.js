const hre = require("hardhat");

async function main() {
  console.log(`Deploying PaymentLedger to network: ${hre.network.name}...`);

  const Ledger = await hre.ethers.getContractFactory("PaymentLedger");
  const ledger = await Ledger.deploy();
  await ledger.waitForDeployment();

  const address = await ledger.getAddress();
  console.log(`\nPaymentLedger deployed to: ${address}`);

  if (hre.network.name === "sepolia") {
    console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  }
  console.log(`\nNext step: put this address in frontend/.env as VITE_PAYMENT_LEDGER_ADDRESS`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
