/* global artifacts */
const childProcess = require("child_process");

const ApprovedTransfer = artifacts.require("ApprovedTransfer");
const CompoundManager = artifacts.require("CompoundManager");
const GuardianManager = artifacts.require("GuardianManager");
const LockManager = artifacts.require("LockManager");
const NftTransfer = artifacts.require("NftTransfer");
const RecoveryManager = artifacts.require("RecoveryManager");
const TokenExchanger = artifacts.require("TokenExchanger");
const MakerV2Manager = artifacts.require("MakerV2Manager");
const TransferManager = artifacts.require("TransferManager");
const RelayerManager = artifacts.require("RelayerManager");
const VersionManager = artifacts.require("VersionManager");

const DeployManager = require("../utils/deploy-manager.js");

// ///////////////////////////////////////////////////////
//                 Version 2.1
// ///////////////////////////////////////////////////////

module.exports = async (callback) => {
  // //////////////////////////////////
  // Setup
  // //////////////////////////////////
  const idx = process.argv.indexOf("--network");
  const network = idx > -1 ? process.argv[idx + 1] : "development";
  console.log(`## ${network} network ##`);

  // TODO: Maybe get the signer account a better way?
  const accounts = await web3.eth.getAccounts();
  const deploymentAccount = accounts[0];

  const manager = new DeployManager(network, deploymentAccount);
  await manager.setup();

  const { configurator } = manager;
  const { abiUploader } = manager;

  const { config } = configurator;
  console.log(config);

  // //////////////////////////////////
  // Deploy VersionManager module
  // //////////////////////////////////
  const VersionManagerWrapper = await VersionManager.new(
    config.contracts.ModuleRegistry,
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    config.modules.TransferStorage,
    config.modules.LimitStorage,
  );

  // //////////////////////////////////
  // Deploy features
  // //////////////////////////////////

  // Deploy the GuardianManager module
  const GuardianManagerWrapper = await GuardianManager.new(
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    VersionManagerWrapper.address,
    config.settings.securityPeriod || 0,
    config.settings.securityWindow || 0,
  );
  // Deploy the LockManager module
  const LockManagerWrapper = await LockManager.new(
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    VersionManagerWrapper.address,
    config.settings.lockPeriod || 0,
  );
  // Deploy the RecoveryManager module
  const RecoveryManagerWrapper = await RecoveryManager.new(
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    VersionManagerWrapper.address,
    config.settings.recoveryPeriod || 0,
    config.settings.lockPeriod || 0,
  );
  // Deploy the ApprovedTransfer module
  const ApprovedTransferWrapper = await ApprovedTransfer.new(
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    config.modules.LimitStorage,
    VersionManagerWrapper.address,
    config.defi.weth,
  );
  // Deploy the TransferManager module
  const TransferManagerWrapper = await TransferManager.new(
    config.modules.LockStorage,
    config.modules.TransferStorage,
    config.modules.LimitStorage,
    config.modules.TokenPriceRegistry,
    VersionManagerWrapper.address,
    config.settings.securityPeriod || 0,
    config.settings.securityWindow || 0,
    config.settings.defaultLimit || "1000000000000000000",
    config.defi.weth,
    ["test", "staging", "prod"].includes(network) ? config.modules.TransferManager : "0x0000000000000000000000000000000000000000",
  );
  // Deploy the TokenExchanger module
  const TokenExchangerWrapper = await TokenExchanger.new(
    config.modules.LockStorage,
    config.modules.TokenPriceRegistry,
    VersionManagerWrapper.address,
    config.contracts.DexRegistry,
    config.defi.paraswap.contract,
    "argent",
  );
  // Deploy the NFTTransfer module
  const NftTransferWrapper = await NftTransfer.new(
    config.modules.LockStorage,
    config.modules.TokenPriceRegistry,
    VersionManagerWrapper.address,
    config.CryptoKitties.contract,
  );
  // Deploy the CompoundManager module
  const CompoundManagerWrapper = await CompoundManager.new(
    config.modules.LockStorage,
    config.defi.compound.comptroller,
    config.contracts.CompoundRegistry,
    VersionManagerWrapper.address,
  );
  // Deploy MakerManagerV2
  const MakerV2ManagerWrapper = await MakerV2Manager.new(
    config.modules.LockStorage,
    config.defi.maker.migration,
    config.defi.maker.pot,
    config.defi.maker.jug,
    config.contracts.MakerRegistry,
    config.defi.uniswap.factory,
    VersionManagerWrapper.address,
  );
  // Deploy RelayerManager
  const RelayerManagerWrapper = await RelayerManager.new(
    config.modules.LockStorage,
    config.modules.GuardianStorage,
    config.modules.LimitStorage,
    config.modules.TokenPriceRegistry,
    VersionManagerWrapper.address,
  );

  // /////////////////////////////////////////////////
  // Update config and Upload ABIs
  // /////////////////////////////////////////////////

  // TODO: change name from "module" to "feature" where appropriate
  configurator.updateModuleAddresses({
    GuardianManager: GuardianManagerWrapper.address,
    LockManager: LockManagerWrapper.address,
    RecoveryManager: RecoveryManagerWrapper.address,
    ApprovedTransfer: ApprovedTransferWrapper.address,
    TransferManager: TransferManagerWrapper.address,
    TokenExchanger: TokenExchangerWrapper.address,
    NftTransfer: NftTransferWrapper.address,
    CompoundManager: CompoundManagerWrapper.address,
    MakerV2Manager: MakerV2ManagerWrapper.address,
    RelayerManager: RelayerManagerWrapper.address,
    VersionManager: VersionManagerWrapper.address,
  });

  const gitHash = childProcess.execSync("git rev-parse HEAD").toString("utf8").replace(/\n$/, "");
  configurator.updateGitHash(gitHash);

  await configurator.save();

  await Promise.all([
    abiUploader.upload(GuardianManagerWrapper, "modules"),
    abiUploader.upload(LockManagerWrapper, "modules"),
    abiUploader.upload(RecoveryManagerWrapper, "modules"),
    abiUploader.upload(ApprovedTransferWrapper, "modules"),
    abiUploader.upload(TransferManagerWrapper, "modules"),
    abiUploader.upload(TokenExchangerWrapper, "modules"),
    abiUploader.upload(NftTransferWrapper, "modules"),
    abiUploader.upload(MakerV2ManagerWrapper, "modules"),
    abiUploader.upload(CompoundManagerWrapper, "modules"),
    abiUploader.upload(RelayerManagerWrapper, "modules"),
    abiUploader.upload(VersionManagerWrapper, "modules"),
  ]);

  console.log("Config:", config);

  callback();
};
