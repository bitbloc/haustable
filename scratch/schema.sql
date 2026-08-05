-- 1. ตารางเก็บข้อมูลบิลหลัก (Order)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    table_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, CLOSED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางเก็บรายการอาหาร (Order Items)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT NOT NULL,
    qty INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    -- กรณีสั่งผ่าน QR มือถือ สามารถเก็บได้ว่าสมาชิกคนไหนในโต๊ะเป็นคนกดสั่ง
    ordered_by_member_id INT, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ตารางการชำระเงิน (Order Payments) - *หัวใจหลักของการแยกแต้ม*
-- 1 บิล (Order) สามารถมีการชำระเงินหลายครั้งได้ (Split Bill)
CREATE TABLE order_payments (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    member_id INT, -- สมาชิกที่รับแต้มสำหรับยอดการจ่ายนี้ (ถ้ามี)
    payment_method VARCHAR(50), -- CASH, CREDIT_CARD, QR_PROMPTPAY
    amount_paid DECIMAL(10, 2) NOT NULL,
    points_earned INT DEFAULT 0, -- แต้มที่คำนวณได้จากยอด amount_paid นี้
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ตารางความเคลื่อนไหวแต้มของสมาชิก (Point Ledger)
CREATE TABLE member_points_ledger (
    id SERIAL PRIMARY KEY,
    member_id INT NOT NULL,
    order_payment_id INT REFERENCES order_payments(id), -- อ้างอิงว่าได้แต้มมาจากการจ่ายเงินก้อนไหน
    points INT NOT NULL, -- ค่าบวก = ได้แต้ม, ค่าลบ = ใช้แต้ม
    transaction_type VARCHAR(20), -- EARN, REDEEM, EXPIRE
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
