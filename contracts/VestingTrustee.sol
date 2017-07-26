pragma solidity ^0.4.11;

import './SaferMath.sol';
import './Ownable.sol';
import './StoxSmartToken.sol';

/// @title Vesting trustee
contract VestingTrustee is Ownable {
    using SaferMath for uint256;

    // The address of the STX ERC20 token.
    StoxSmartToken public stox;

    struct Grant {
        address granter;
        uint256 value;
        uint256 start;
        uint256 cliff;
        uint256 end;
        uint256 transferred;
    }

    // Grants holder.
    mapping (address => Grant) public grants;

    // Total tokens available for vesting.
    uint256 public totalVesting;

    event NewGrant(address indexed _from, address indexed _to, uint256 _value);
    event UnlockGrant(address indexed _to, address _granter, uint256 _value);

    /// @dev Constructor that initializes the address of the StoxSmartToken contract.
    /// @param _stox StoxSmartToken The address of the previously deployed StoxSmartToken smart contract.
    function VestingTrustee(StoxSmartToken _stox) {
        require(_stox != address(0));

        stox = _stox;
    }

    /// @dev Gets the current STX balance of the vesting trustee.
    /// @return An uint256 representing the amount owned by contract itself.
    function balance() public constant returns (uint256 balance) {
        return stox.balanceOf(address(this));
    }

    /// @dev Grant tokens to a specified address.
    /// @param _to address The address to grant tokens to.
    /// @param _value uint256 The amount of tokens to be granted.
    /// @param _start uint256 The beginning of the vesting period.
    /// @param _cliff uint256 Duration of the cliff period.
    /// @param _end uint256 The end of the vesting period.
    function grant(address _to, uint256 _value, uint256 _start, uint256 _cliff, uint256 _end) public onlyOwner {
        require(_to != address(0));
        require(_value > 0);

        // Make sure that a single address can be granted tokens only once.
        require(grants[_to].granter == 0);

        // Check for date inconsistencies that may cause unexpected behavior.
        require(_start <= _cliff && _cliff <= _end);

        // Check that this grant doesn't exceed the total amount of tokens currently available for vesting.
        require(totalVesting.add(_value) <= balance());

        // Assign a new grant.
        grants[_to] = Grant(msg.sender, _value, _start, _cliff, _end, 0);

        // Tokens granted, reduce the total amount available for vesting.
        totalVesting = totalVesting.add(_value);

        NewGrant(msg.sender, _to, _value);
    }

    /// @dev Calculate the total amount of vested tokens of a holder at a given time.
    /// @param _holder address The address of the holder.
    /// @param _time uint256 The specific time.
    /// @return a uint256 representing a holder's total amount of vested tokens.
    function vestedTokens(address _holder, uint256 _time) public constant returns (uint256) {
        Grant grant = grants[_holder];
        if (grant.granter == 0) {
            return 0;
        }

        return calculateVestedTokens(grant, _time);
    }

    /// @dev Calculate amount of vested tokens at a specifc time.
    /// @param _grant Grant The vesting grant.
    /// @param _time uint256 The time to be checked
    /// @return An uint256 representing the amount of vested tokens of a specific grant.
    ///   |                         _/--------   vestedTokens rect
    ///   |                       _/
    ///   |                     _/
    ///   |                   _/
    ///   |                 _/
    ///   |                /
    ///   |              .|
    ///   |            .  |
    ///   |          .    |
    ///   |        .      |
    ///   |      .        |
    ///   |    .          |
    ///   +===+===========+---------+----------> time
    ///     Start       Cliff      End
    function calculateVestedTokens(Grant _grant, uint256 _time) private constant returns (uint256) {
        // If we're before the cliff, then nothing is vested.
        if (_time < _grant.cliff) {
            return 0;
        }

        // If we're after the end of the vesting period - everything is vested;
        if (_time >= _grant.end) {
            return _grant.value;
        }

        // Interpolate all vested tokens: vestedTokens = tokens/// (time - start) / (end - start)
         return _grant.value.mul(_time.sub(_grant.start)).div(_grant.end.sub(_grant.start));
    }

    /// @dev Unlock vested tokens and transfer them to their holder.
    /// @return a uint256 representing the amount of vested tokens transferred to their holder.
    function unlockVestedTokens() public {
        Grant grant = grants[msg.sender];
        assert(grant.granter != 0);

        // Get the total amount of vested tokens, acccording to grant.
        uint256 vested = calculateVestedTokens(grant, now);
        if (vested == 0) {
            return;
        }

        // Make sure the holder doesn't transfer more than what he already has.
        uint256 transferable = vested.sub(grant.transferred);
        if (transferable == 0) {
            return;
        }

        grant.transferred = grant.transferred.add(transferable);
        totalVesting = totalVesting.sub(transferable);
        stox.transfer(msg.sender, transferable);

        UnlockGrant(msg.sender, grant.granter, transferable);
    }
}
