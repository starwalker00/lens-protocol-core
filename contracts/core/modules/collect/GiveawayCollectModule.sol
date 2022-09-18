// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {DataTypes} from '../../../libraries/DataTypes.sol'; // Publication Struct
import {ModuleBase} from '../ModuleBase.sol';
import {IERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';

/**
 * @title GiveawayCollectModule
 * @author
 *
 * @notice
 *
 * This module works by triggering a giveaway of an amount provisionned by the publisher to a
 * random collector when collector threshold is reached.
 */
contract GiveawayCollectModule is ModuleBase, ICollectModule, VRFConsumerBaseV2 {
    // VRF temporary config
    VRFCoordinatorV2Interface COORDINATOR;
    address vrfCoordinator = 0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D;
    bytes32 keyHash = 0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15;
    uint32 callbackGasLimit = 100000;
    uint16 requestConfirmations = 3;
    uint32 numWords = 2;
    uint64 s_subscriptionId = 1;

    enum GiveawayStatus {
        Active,
        Triggered,
        Done
    }
    struct GiveawayPublicationData {
        uint256 currencyAmount;
        uint256 collectAmount;
        GiveawayStatus status;
        uint256 s_requestId;
        uint256 s_randomWord;
    }

    // Maps giveaway data to a publication
    mapping(uint256 => mapping(uint256 => GiveawayPublicationData))
        internal _dataByPublicationByProfile;

    // Maps VRF request to a publication
    mapping(uint256 => DataTypes.PublicationStruct) internal _pubByRequestId;

    constructor(address hub) ModuleBase(hub) VRFConsumerBaseV2(vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
    }

    /**
     * @notice This collect module triggers a giveaway at a provided collected amount. Thus, we need to decode data.
     *
     * @param profileId The token ID of the profile of the publisher, passed by the hub.
     * @param pubId The publication ID of the newly created publication, passed by the hub.
     * @param data The arbitrary data parameter, decoded into:
     *      uint256 currencyAmount: The total amount to give away.
     *      uint256 collectAmount: The number of collect needed to trigger the giveaway.
     *
     * @return bytes An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (uint256 currencyAmount, uint256 collectAmount) = abi.decode(data, (uint256, uint256));
        _dataByPublicationByProfile[profileId][pubId].currencyAmount = currencyAmount;
        _dataByPublicationByProfile[profileId][pubId].collectAmount = collectAmount;
        _dataByPublicationByProfile[profileId][pubId].status = GiveawayStatus.Active;
        return data;
    }

    /**
     * @dev Processes a collect by:
     *  1. Triggering the giveaway if collectAmount is reached.
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override {
        if (_dataByPublicationByProfile[profileId][pubId].status != GiveawayStatus.Active) {
            // giveaway already triggered
            revert Errors.CollectNotAllowed();
        }
        address collectNFT = ILensHub(HUB).getCollectNFT(profileId, pubId);
        uint256 totalSupply = IERC721Enumerable(collectNFT).totalSupply();
        if (_dataByPublicationByProfile[profileId][pubId].collectAmount >= totalSupply) {
            // _triggerGiveaway();
            _requestRandomWords(profileId, pubId);
        }
    }

    function _triggerGiveaway() internal {}

    function _requestRandomWords(uint256 profileId, uint256 pubId) internal {
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        _dataByPublicationByProfile[profileId][pubId].s_requestId = requestId; // not strictly necessary
        _pubByRequestId[requestId].profileIdPointed = profileId;
        _pubByRequestId[requestId].pubIdPointed = pubId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 profileId = _pubByRequestId[requestId].profileIdPointed;
        uint256 pubId = _pubByRequestId[requestId].pubIdPointed;
        _dataByPublicationByProfile[profileId][pubId].status = GiveawayStatus.Done;
    }

    function getPublicationData(uint256 profileId, uint256 pubId)
        external
        view
        returns (GiveawayPublicationData memory)
    {
        return _dataByPublicationByProfile[profileId][pubId];
    }
}
