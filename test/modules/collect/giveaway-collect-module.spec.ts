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
  REFERRAL_FEE_BPS,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Fee Collect Module', function () {
  const DEFAULT_COLLECT_PRICE = parseEther('10');

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
  });

  context('Scenarios', function () {
    it('User should post with fee collect module as the collect module and data, correct events should be emitted', async function () {
      const collectModuleInitData = abiCoder.encode(
        ['uint256', 'uint256'],
        [parseEther('0.1'), 2]
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
        [parseEther('0.1'), 2]
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
      expect(fetchedData.currencyAmount).to.eq(parseEther('0.1'));
      expect(fetchedData.collectAmount).to.eq(2);
    });

    // it('User should post with the fee collect module as the collect module and data, allowing non-followers to collect, user two collects without following, fee distribution is valid', async function () {
    //   const collectModuleInitData = abiCoder.encode(
    //     ['uint256', 'address', 'address', 'uint16', 'bool'],
    //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS, false]
    //   );
    //   await expect(
    //     lensHub.post({
    //       profileId: FIRST_PROFILE_ID,
    //       contentURI: MOCK_URI,
    //       collectModule: feeCollectModule.address,
    //       collectModuleInitData: collectModuleInitData,
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;
    // 
    //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
    //   await expect(
    //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
    //   ).to.not.be.reverted;
    //   const data = abiCoder.encode(
    //     ['address', 'uint256'],
    //     [currency.address, DEFAULT_COLLECT_PRICE]
    //   );
    //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

    //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .mul(TREASURY_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedRecipientAmount =
    //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

    //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
    //     BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
    //   );
    //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
    //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    // });

    // it('User should post with the fee collect module as the collect module and data, user two follows, then collects and pays fee, fee distribution is valid', async function () {
    //   const collectModuleInitData = abiCoder.encode(
    //     ['uint256', 'address', 'address', 'uint16', 'bool'],
    //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS, true]
    //   );
    //   await expect(
    //     lensHub.post({
    //       profileId: FIRST_PROFILE_ID,
    //       contentURI: MOCK_URI,
    //       collectModule: feeCollectModule.address,
    //       collectModuleInitData: collectModuleInitData,
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
    //   await expect(
    //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
    //   ).to.not.be.reverted;
    //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
    //   const data = abiCoder.encode(
    //     ['address', 'uint256'],
    //     [currency.address, DEFAULT_COLLECT_PRICE]
    //   );
    //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

    //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .mul(TREASURY_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedRecipientAmount =
    //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

    //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
    //     BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
    //   );
    //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
    //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    // });

    // it('User should post with the fee collect module as the collect module and data, user two follows, then collects twice, fee distribution is valid', async function () {
    //   const collectModuleInitData = abiCoder.encode(
    //     ['uint256', 'address', 'address', 'uint16', 'bool'],
    //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS, true]
    //   );
    //   await expect(
    //     lensHub.post({
    //       profileId: FIRST_PROFILE_ID,
    //       contentURI: MOCK_URI,
    //       collectModule: feeCollectModule.address,
    //       collectModuleInitData: collectModuleInitData,
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
    //   await expect(
    //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
    //   ).to.not.be.reverted;
    //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
    //   const data = abiCoder.encode(
    //     ['address', 'uint256'],
    //     [currency.address, DEFAULT_COLLECT_PRICE]
    //   );
    //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;
    //   await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, 1, data)).to.not.be.reverted;

    //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .mul(TREASURY_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedRecipientAmount =
    //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

    //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
    //     BigNumber.from(MAX_UINT256).sub(BigNumber.from(DEFAULT_COLLECT_PRICE).mul(2))
    //   );
    //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount.mul(2));
    //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount.mul(2));
    // });

    // it('User should post with the fee collect module as the collect module and data, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
    //   const secondProfileId = FIRST_PROFILE_ID + 1;
    //   const collectModuleInitData = abiCoder.encode(
    //     ['uint256', 'address', 'address', 'uint16', 'bool'],
    //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, REFERRAL_FEE_BPS, true]
    //   );

    //   await expect(
    //     lensHub.post({
    //       profileId: FIRST_PROFILE_ID,
    //       contentURI: MOCK_URI,
    //       collectModule: feeCollectModule.address,
    //       collectModuleInitData: collectModuleInitData,
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(
    //     lensHub.connect(userTwo).createProfile({
    //       to: userTwoAddress,
    //       handle: 'usertwo',
    //       imageURI: MOCK_PROFILE_URI,
    //       followModule: ZERO_ADDRESS,
    //       followModuleInitData: [],
    //       followNFTURI: MOCK_FOLLOW_NFT_URI,
    //     })
    //   ).to.not.be.reverted;
    //   await expect(
    //     lensHub.connect(userTwo).mirror({
    //       profileId: secondProfileId,
    //       profileIdPointed: FIRST_PROFILE_ID,
    //       pubIdPointed: 1,
    //       referenceModuleData: [],
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
    //   await expect(
    //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
    //   ).to.not.be.reverted;
    //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
    //   const data = abiCoder.encode(
    //     ['address', 'uint256'],
    //     [currency.address, DEFAULT_COLLECT_PRICE]
    //   );
    //   await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

    //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .mul(TREASURY_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedReferralAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .sub(expectedTreasuryAmount)
    //     .mul(REFERRAL_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedReferrerAmount = BigNumber.from(MAX_UINT256)
    //     .sub(DEFAULT_COLLECT_PRICE)
    //     .add(expectedReferralAmount);
    //   const expectedRecipientAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .sub(expectedTreasuryAmount)
    //     .sub(expectedReferralAmount);

    //   expect(await currency.balanceOf(userTwoAddress)).to.eq(expectedReferrerAmount);
    //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
    //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    // });

    // it('User should post with the fee collect module as the collect module and data, with no referral fee, user two mirrors, follows, then collects from their mirror and pays fee, fee distribution is valid', async function () {
    //   const secondProfileId = FIRST_PROFILE_ID + 1;
    //   const collectModuleInitData = abiCoder.encode(
    //     ['uint256', 'address', 'address', 'uint16', 'bool'],
    //     [DEFAULT_COLLECT_PRICE, currency.address, userAddress, 0, true]
    //   );

    //   await expect(
    //     lensHub.post({
    //       profileId: FIRST_PROFILE_ID,
    //       contentURI: MOCK_URI,
    //       collectModule: feeCollectModule.address,
    //       collectModuleInitData: collectModuleInitData,
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(
    //     lensHub.connect(userTwo).createProfile({
    //       to: userTwoAddress,
    //       handle: 'usertwo',
    //       imageURI: MOCK_PROFILE_URI,
    //       followModule: ZERO_ADDRESS,
    //       followModuleInitData: [],
    //       followNFTURI: MOCK_FOLLOW_NFT_URI,
    //     })
    //   ).to.not.be.reverted;
    //   await expect(
    //     lensHub.connect(userTwo).mirror({
    //       profileId: secondProfileId,
    //       profileIdPointed: FIRST_PROFILE_ID,
    //       pubIdPointed: 1,
    //       referenceModuleData: [],
    //       referenceModule: ZERO_ADDRESS,
    //       referenceModuleInitData: [],
    //     })
    //   ).to.not.be.reverted;

    //   await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
    //   await expect(
    //     currency.connect(userTwo).approve(feeCollectModule.address, MAX_UINT256)
    //   ).to.not.be.reverted;
    //   await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
    //   const data = abiCoder.encode(
    //     ['address', 'uint256'],
    //     [currency.address, DEFAULT_COLLECT_PRICE]
    //   );
    //   await expect(lensHub.connect(userTwo).collect(secondProfileId, 1, data)).to.not.be.reverted;

    //   const expectedTreasuryAmount = BigNumber.from(DEFAULT_COLLECT_PRICE)
    //     .mul(TREASURY_FEE_BPS)
    //     .div(BPS_MAX);
    //   const expectedRecipientAmount =
    //     BigNumber.from(DEFAULT_COLLECT_PRICE).sub(expectedTreasuryAmount);

    //   expect(await currency.balanceOf(userTwoAddress)).to.eq(
    //     BigNumber.from(MAX_UINT256).sub(DEFAULT_COLLECT_PRICE)
    //   );
    //   expect(await currency.balanceOf(userAddress)).to.eq(expectedRecipientAmount);
    //   expect(await currency.balanceOf(treasuryAddress)).to.eq(expectedTreasuryAmount);
    // });
  });
});
