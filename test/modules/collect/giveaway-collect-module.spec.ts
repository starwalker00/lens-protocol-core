import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ERC20__factory } from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  BPS_MAX,
  currency,
  feeCollectModule,
  giveawayCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  lensHubImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  provider,
  REFERRAL_FEE_BPS,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  vrfCoordinatorV2Mock
} from '../../__setup.spec';

makeSuiteCleanRoom('Fee Collect Module', function () {
  const DEFAULT_COLLECT_PRICE = parseEther('10');
  const DEFAULT_GIVEAWAY_AMOUNT = parseEther('1.337');
  const DEFAULT_COLLECT_AMOUNT = 2;

  beforeEach(async function () {
    await expect(
      lensHub.createProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      })
    ).to.not.be.reverted;
    await expect(
      lensHub.connect(governance).whitelistCollectModule(giveawayCollectModule.address, true)
    ).to.not.be.reverted;
    await expect(
      vrfCoordinatorV2Mock.createSubscription()
    ).to.not.be.reverted;
    await expect( // fund the contract for testing purposes 
      user.sendTransaction({
        to: giveawayCollectModule.address,
        value: parseEther("10"),
      })
    ).to.not.be.reverted;
  });

  context('Scenarios', function () {
    it('User should post with fee collect module as the collect module and data, correct events should be emitted', async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );

      const tx = lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: giveawayCollectModule.address,
        collectModuleInitData: collectModuleInitData,
        referenceModule: ZERO_ADDRESS,
        referenceModuleInitData: [],
      });

      const receipt = await waitForTx(tx);
      console.log(receipt)
      console.log(receipt.logs.length)
      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'PostCreated', [
        FIRST_PROFILE_ID,
        1,
        MOCK_URI,
        giveawayCollectModule.address,
        [collectModuleInitData],
        ZERO_ADDRESS,
        [],
        await getTimestamp(),
      ]);
    });

    it('User should post with the fee collect module as the collect module and data, fetched publication data should be accurate', async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      const postTimestamp = await getTimestamp();

      const fetchedData = await giveawayCollectModule.getPublicationData(FIRST_PROFILE_ID, 1);
      expect(fetchedData.currencyAmount).to.eq(DEFAULT_GIVEAWAY_AMOUNT);
      expect(fetchedData.collectAmount).to.eq(DEFAULT_COLLECT_AMOUNT);
    });

    it('User should post with the giveaway collect module as the collect module and data, user two should be able to collect', async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.not.be.reverted;
    });

    it('Module should trigger request randomness when collect amount is reached', async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      console.log("first collect:");
      let tx1 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx1");
      console.log(tx1);
      console.log("second collect:");
      // let tx2 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      // console.log("tx2");
      // console.log(tx2);
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.emit(
        giveawayCollectModule,
        "RandomnessRequested"
      ).withArgs(1, lensHub.address, FIRST_PROFILE_ID, 1);
    });

    it("VRF coordinator should successfully receive the request", async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      console.log("first collect:");
      let tx1 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx1");
      console.log(tx1);
      console.log("second collect:");
      // let tx2 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      // console.log("tx2");
      // console.log(tx2);
      await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, [])).to.emit(
        vrfCoordinatorV2Mock,
        "RandomWordsRequested"
      );
    })

    it("VRF coordinator should fulfill Random Number request", async () => {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      console.log("first collect:");
      let tx1 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx1");
      console.log(tx1);
      console.log("second collect:");
      let tx2 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx2");
      console.log(tx2);
      let receipt2 = await tx2.wait();
      console.log(receipt2);
      // TODO : get requestId from contract event , event is triggered by vrfCoordinatorV2Mock contract, not lensHub
      // const event = receipt2.events?.find(event => event.event === 'RandomnessRequested');
      // console.log(event);
      // const args = event?.args;
      // console.log(args);
      let requestId = 1;
      await expect(
        vrfCoordinatorV2Mock.fulfillRandomWords(requestId, giveawayCollectModule.address)
      ).to.emit(vrfCoordinatorV2Mock, "RandomWordsFulfilled")
    });

    it("Module should properly execute the giveaway", async () => {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [DEFAULT_GIVEAWAY_AMOUNT, DEFAULT_COLLECT_AMOUNT]
      );
      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: giveawayCollectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      console.log("first collect:");
      let tx1 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx1");
      console.log(tx1);
      console.log("second collect:");
      let tx2 = await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, []);
      console.log("tx2");
      console.log(tx2);
      let receipt2 = await tx2.wait();
      console.log(receipt2);
      let requestId = 1;
      const balanceContractBefore = await provider.getBalance(giveawayCollectModule.address);
      console.log("balanceContractBefore");
      console.log(balanceContractBefore.toString());
      // verify status is not "Done" (2)
      const fetchedDataBefore = await giveawayCollectModule.getPublicationData(FIRST_PROFILE_ID, 1);
      expect(fetchedDataBefore.status).to.not.eq(2);
      console.log(fetchedDataBefore);
      await expect(
        vrfCoordinatorV2Mock.fulfillRandomWords(requestId, giveawayCollectModule.address)
      ).to.emit(giveawayCollectModule, "RandomnessReceived");
      // verify status is "Done" (2)
      const fetchedDataAfter = await giveawayCollectModule.getPublicationData(FIRST_PROFILE_ID, 1);
      console.log(fetchedDataAfter);
      expect(fetchedDataAfter.status).to.eq(2);

      // verify balances
      const balanceContractAfter = await provider.getBalance(giveawayCollectModule.address);
      console.log("balanceContractAfter");
      console.log(balanceContractAfter.toString());
      expect(balanceContractBefore.sub(balanceContractAfter)).to.equal(parseEther("1.337"));

    });
  });
});
