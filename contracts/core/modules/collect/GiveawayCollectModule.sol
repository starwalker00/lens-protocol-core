// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {IERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import {ILensHub} from '../../../interfaces/ILensHub.sol';

/**
 * @title GiveawayCollectModule
 * @author
 *
 * @notice
 *
 * This module works by triggering a giveaway of an amount provisionned by the publisher to a
 * random collector when collector threshold is reached.
 */
contract GiveawayCollectModule is ModuleBase, ICollectModule {
    enum GiveawayStatus {
        Active,
        Triggered,
        Done
    }
    struct GiveawayPublicationData {
        uint256 currencyAmount;
        uint256 collectAmount;
        GiveawayStatus status;
    }
    mapping(uint256 => mapping(uint256 => GiveawayPublicationData))
        internal _dataByPublicationByProfile;

    constructor(address hub) ModuleBase(hub) {}

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
            _triggerGiveaway();
        }
    }

    function _triggerGiveaway() internal {}
}
