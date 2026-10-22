// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PaymentLedger
/// @notice Moves real ETH from sender to receiver AND records the payment
/// on-chain (sender, receiver, amount, purpose, timestamp) in the same
/// atomic transaction — the fund transfer and the ledger entry can never
/// go out of sync: if forwarding the funds fails, the whole transaction
/// (including the record) reverts.
contract PaymentLedger {
    struct Payment {
        address sender;
        address receiver;
        uint256 amount; // wei
        string purpose;
        uint256 timestamp;
    }

    Payment[] public payments;
    mapping(address => uint256[]) private sentPaymentIds;
    mapping(address => uint256[]) private receivedPaymentIds;

    event PaymentMade(
        uint256 indexed paymentId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        string purpose,
        uint256 timestamp
    );

    /// @notice Send the attached ETH to `receiver` and record the payment.
    /// `purpose` is a short free-text label (e.g. "p2p_transfer",
    /// "publishing_fee", "book_purchase") mirroring the platform's
    /// off-chain Transaction.type field, so on-chain and off-chain
    /// records can be cross-referenced.
    function makePayment(address payable receiver, string calldata purpose) external payable {
        require(receiver != address(0), "Invalid receiver address");
        require(msg.value > 0, "Payment amount must be greater than zero");
        require(receiver != msg.sender, "Cannot pay yourself");

        uint256 paymentId = payments.length;
        payments.push(Payment({
            sender: msg.sender,
            receiver: receiver,
            amount: msg.value,
            purpose: purpose,
            timestamp: block.timestamp
        }));
        sentPaymentIds[msg.sender].push(paymentId);
        receivedPaymentIds[receiver].push(paymentId);

        (bool sent, ) = receiver.call{value: msg.value}("");
        require(sent, "Failed to forward payment to receiver");

        emit PaymentMade(paymentId, msg.sender, receiver, msg.value, purpose, block.timestamp);
    }

    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }

    function getPayment(uint256 paymentId)
        external
        view
        returns (address sender, address receiver, uint256 amount, string memory purpose, uint256 timestamp)
    {
        Payment storage p = payments[paymentId];
        return (p.sender, p.receiver, p.amount, p.purpose, p.timestamp);
    }

    function getSentPaymentIds(address user) external view returns (uint256[] memory) {
        return sentPaymentIds[user];
    }

    function getReceivedPaymentIds(address user) external view returns (uint256[] memory) {
        return receivedPaymentIds[user];
    }
}
