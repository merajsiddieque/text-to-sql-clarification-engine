"""
Database initialization script for the Demo E-commerce & Analytics SQLite database.
Generates realistic multi-table relational data designed for Text-to-SQL & ambiguity testing.
"""

import os
import sqlite3
from datetime import datetime, timedelta
import random

DEMO_DB_PATH = os.path.join(os.path.dirname(__file__), "ecommerce.db")


def create_schema(cursor: sqlite3.Cursor):
    cursor.executescript("""
    DROP TABLE IF EXISTS product_reviews;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS customers;

    CREATE TABLE categories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );

    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL,
        city TEXT NOT NULL,
        signup_date DATE NOT NULL,
        account_status TEXT NOT NULL CHECK(account_status IN ('active', 'inactive', 'suspended'))
    );

    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATE NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );

    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_date TIMESTAMP NOT NULL,
        order_status TEXT NOT NULL CHECK(order_status IN ('completed', 'processing', 'cancelled', 'refunded')),
        shipping_country TEXT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    CREATE TABLE order_items (
        order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    CREATE TABLE product_reviews (
        review_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        review_text TEXT,
        review_date DATE NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(product_id),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    CREATE INDEX idx_orders_customer ON orders(customer_id);
    CREATE INDEX idx_orders_date ON orders(order_date);
    CREATE INDEX idx_order_items_order ON order_items(order_id);
    CREATE INDEX idx_order_items_product ON order_items(product_id);
    CREATE INDEX idx_reviews_product ON product_reviews(product_id);
    """)


def seed_data(cursor: sqlite3.Cursor):
    random.seed(42)

    categories = [
        ("Electronics", "Smartphones, laptops, accessories, and audio gear"),
        ("Home & Kitchen", "Appliances, furniture, and kitchenware"),
        ("Apparel", "Men and women clothing, footwear, and accessories"),
        ("Books & Stationery", "Novels, technical books, and office supplies"),
        ("Health & Wellness", "Supplements, exercise equipment, and personal care"),
    ]
    cursor.executemany("INSERT INTO categories (name, description) VALUES (?, ?);", categories)

    products_data = [
        ("Quantum Pro Noise-Cancelling Headphones", 1, 299.99, 140.00, 120, "2023-01-15"),
        ("Aura Wireless Charging Pad", 1, 39.99, 12.50, 450, "2023-02-10"),
        ("UltraView 4K OLED Monitor 32-inch", 1, 799.00, 450.00, 60, "2023-03-01"),
        ("HyperMech RGB Mechanical Keyboard", 1, 129.50, 60.00, 210, "2023-01-20"),
        ("OmniStream 1080p HD Webcam", 1, 69.99, 28.00, 310, "2023-04-12"),
        ("Espresso Deluxe Coffee Machine", 2, 450.00, 220.00, 45, "2023-02-18"),
        ("ThermoSmart Electric Kettle", 2, 59.99, 22.00, 180, "2023-03-15"),
        ("Cast Iron Dutch Oven 6-Quart", 2, 89.95, 38.00, 95, "2023-01-05"),
        ("Robot Vac Auto-Empty Station", 2, 599.00, 320.00, 35, "2023-05-02"),
        ("Ergonomic Bamboo Standing Desk", 2, 389.00, 190.00, 50, "2023-04-20"),
        ("Merino Wool Crewneck Sweater", 3, 110.00, 42.00, 140, "2023-02-25"),
        ("Waterproof Trail Runner Shoes", 3, 145.00, 58.00, 115, "2023-03-30"),
        ("Everyday Canvas Commuter Backpack", 3, 75.00, 25.00, 250, "2023-01-11"),
        ("Classic Aviator Polarized Sunglasses", 3, 85.00, 20.00, 190, "2023-06-01"),
        ("Designing Data-Intensive Applications", 4, 48.00, 22.00, 300, "2023-01-01"),
        ("Deep Learning with Python (2nd Ed)", 4, 54.00, 24.00, 180, "2023-02-01"),
        ("Hardcover Dotted Grid Journal", 4, 18.50, 5.00, 600, "2023-01-01"),
        ("Premium Whey Protein Powder (2kg)", 5, 62.00, 28.00, 220, "2023-03-05"),
        ("Adjustable Dumbbell Set 50lbs", 5, 299.00, 150.00, 40, "2023-04-10"),
        ("Smart Fitness Tracker Band", 5, 89.00, 35.00, 175, "2023-05-15"),
    ]
    cursor.executemany("""
        INSERT INTO products (name, category_id, unit_price, cost_price, stock_quantity, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
    """, products_data)

    countries = ["United States", "United Kingdom", "Germany", "Canada", "Australia", "France", "Japan"]
    cities = {
        "United States": ["New York", "San Francisco", "Austin", "Seattle", "Chicago"],
        "United Kingdom": ["London", "Manchester", "Edinburgh"],
        "Germany": ["Berlin", "Munich", "Hamburg"],
        "Canada": ["Toronto", "Vancouver", "Montreal"],
        "Australia": ["Sydney", "Melbourne", "Brisbane"],
        "France": ["Paris", "Lyon"],
        "Japan": ["Tokyo", "Osaka"]
    }

    first_names = ["Emma", "Liam", "Sophia", "Noah", "Olivia", "Ethan", "Ava", "Lucas", "Mia", "Oliver",
                   "Isabella", "Alexander", "Charlotte", "Elijah", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Mason",
                   "Hannah", "Daniel", "Emily", "Henry", "Zoe", "Jack", "Chloe", "Samuel", "Grace", "David"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]

    customers = []
    base_date = datetime(2023, 1, 1)
    for i in range(1, 41):
        fn = first_names[i % len(first_names)]
        ln = last_names[i % len(last_names)]
        country = random.choice(countries)
        city = random.choice(cities[country])
        signup_dt = (base_date + timedelta(days=random.randint(0, 300))).strftime("%Y-%m-%d")
        status = "active" if random.random() < 0.85 else "inactive"
        email = f"{fn.lower()}.{ln.lower()}{i}@example.com"
        customers.append((fn, ln, email, country, city, signup_dt, status))

    cursor.executemany("""
        INSERT INTO customers (first_name, last_name, email, country, city, signup_date, account_status)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, customers)

    # Orders & Order Items
    order_statuses = ["completed", "completed", "completed", "completed", "processing", "cancelled", "refunded"]
    orders = []
    order_items = []
    order_id = 1

    start_order_date = datetime(2023, 3, 1)
    for _ in range(120):
        cust_id = random.randint(1, len(customers))
        cust_country = customers[cust_id - 1][3]
        days_offset = random.randint(0, 360)
        ord_date = start_order_date + timedelta(days=days_offset, hours=random.randint(8, 22), minutes=random.randint(0, 59))
        status = random.choice(order_statuses)
        
        # 1 to 4 distinct items per order
        num_items = random.randint(1, 4)
        selected_prod_ids = random.sample(range(1, len(products_data) + 1), num_items)
        
        total_order_amount = 0.0
        for pid in selected_prod_ids:
            prod_info = products_data[pid - 1]
            qty = random.randint(1, 3)
            price = prod_info[2]
            discount = 5.0 if qty > 1 and random.random() < 0.3 else 0.0
            line_total = round((price * qty) - discount, 2)
            total_order_amount += line_total
            order_items.append((order_id, pid, qty, price, discount))

        orders.append((cust_id, ord_date.strftime("%Y-%m-%d %H:%M:%S"), status, cust_country, round(total_order_amount, 2)))
        order_id += 1

    cursor.executemany("""
        INSERT INTO orders (customer_id, order_date, order_status, shipping_country, total_amount)
        VALUES (?, ?, ?, ?, ?);
    """, orders)

    cursor.executemany("""
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount)
        VALUES (?, ?, ?, ?, ?);
    """, order_items)

    # Product Reviews
    review_comments = [
        (5, "Exceptional quality! Exceeded my expectations."),
        (4, "Really solid build and works as advertised. Recommended."),
        (5, "Best purchase of the year, customer support was also great."),
        (3, "Decent, but a bit overpriced for what it provides."),
        (2, "Had some minor issues after two weeks of usage."),
        (5, "Flawless performance, sleek design."),
        (4, "Good value for money, arrived faster than expected."),
        (1, "Did not work out of the box, requesting refund.")
    ]
    reviews = []
    for _ in range(85):
        pid = random.randint(1, len(products_data))
        cid = random.randint(1, len(customers))
        rating, comment = random.choice(review_comments)
        rev_date = (datetime(2023, 4, 1) + timedelta(days=random.randint(0, 300))).strftime("%Y-%m-%d")
        reviews.append((pid, cid, rating, comment, rev_date))

    cursor.executemany("""
        INSERT INTO product_reviews (product_id, customer_id, rating, review_text, review_date)
        VALUES (?, ?, ?, ?, ?);
    """, reviews)


def init_database() -> str:
    os.makedirs(os.path.dirname(DEMO_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DEMO_DB_PATH)
    try:
        cursor = conn.cursor()
        create_schema(cursor)
        seed_data(cursor)
        conn.commit()
    finally:
        conn.close()
    return DEMO_DB_PATH


if __name__ == "__main__":
    path = init_database()
    print(f"Demo SQLite database initialized successfully at: {path}")
