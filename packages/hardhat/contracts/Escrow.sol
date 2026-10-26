// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Escrow {
    enum Status {
        Created,
        Paid,
        Completed,
        Refunded,
        Disputed
    }

    struct Order {
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 deadline;
        Status status;
        string description;
    }

    address public arbiter;
    uint256 public orderCount;
    mapping(uint256 => Order) private _orders;

    event OrderCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event OrderPaid(uint256 indexed id);
    event OrderCompleted(uint256 indexed id);
    event OrderRefunded(uint256 indexed id);
    event OrderDisputed(uint256 indexed id);
    event OrderResolved(uint256 indexed id, bool sellerWins);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Escrow: not arbiter");
        _;
    }

    modifier onlyBuyer(uint256 id) {
        require(msg.sender == _orders[id].buyer, "Escrow: not buyer");
        _;
    }

    modifier inStatus(uint256 id, Status s) {
        require(_orders[id].status == s, "Escrow: wrong status");
        _;
    }

    constructor(address _arbiter) {
        require(_arbiter != address(0), "Escrow: zero arbiter");
        arbiter = _arbiter;
    }

    function getOrder(uint256 id) public view returns (Order memory) {
        require(id < orderCount, "Escrow: bad id");
        return _orders[id];
    }

    function createOrder(
        address seller,
        address token,
        uint256 amount,
        uint256 deadline,
        string memory description
    ) public returns (uint256) {
        require(seller != address(0), "Escrow: zero seller");
        require(seller != msg.sender, "Escrow: self trade");
        require(token != address(0), "Escrow: zero token");
        require(amount > 0, "Escrow: zero amount");
        require(deadline > block.timestamp, "Escrow: bad deadline");

        uint256 id = orderCount;
        _orders[id] = Order({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            deadline: deadline,
            status: Status.Created,
            description: description
        });
        orderCount += 1;

        emit OrderCreated(id, msg.sender, seller, token, amount, deadline);
        return id;
    }

    function deposit(uint256 id) public onlyBuyer(id) inStatus(id, Status.Created) {
        Order storage o = _orders[id];
        o.status = Status.Paid;
        bool ok = IERC20(o.token).transferFrom(o.buyer, address(this), o.amount);
        require(ok, "Escrow: transfer failed");
        emit OrderPaid(id);
    }

    function confirm(uint256 id) public onlyBuyer(id) inStatus(id, Status.Paid) {
        Order storage o = _orders[id];
        o.status = Status.Completed;
        bool ok = IERC20(o.token).transfer(o.seller, o.amount);
        require(ok, "Escrow: transfer failed");
        emit OrderCompleted(id);
    }

    function refund(uint256 id) public onlyBuyer(id) inStatus(id, Status.Paid) {
        Order storage o = _orders[id];
        require(block.timestamp > o.deadline, "Escrow: too early");
        o.status = Status.Refunded;
        bool ok = IERC20(o.token).transfer(o.buyer, o.amount);
        require(ok, "Escrow: transfer failed");
        emit OrderRefunded(id);
    }

    function dispute(uint256 id) public inStatus(id, Status.Paid) {
        Order storage o = _orders[id];
        require(msg.sender == o.buyer || msg.sender == o.seller, "Escrow: not party");
        o.status = Status.Disputed;
        emit OrderDisputed(id);
    }

    function resolve(uint256 id, bool sellerWins) public onlyArbiter inStatus(id, Status.Disputed) {
        Order storage o = _orders[id];
        if (sellerWins) {
            o.status = Status.Completed;
            bool ok = IERC20(o.token).transfer(o.seller, o.amount);
            require(ok, "Escrow: transfer failed");
        } else {
            o.status = Status.Refunded;
            bool ok = IERC20(o.token).transfer(o.buyer, o.amount);
            require(ok, "Escrow: transfer failed");
        }
        emit OrderResolved(id, sellerWins);
    }
}
