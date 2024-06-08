CREATE DATABASE library_management;
USE library_management;

CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('client', 'admin') NOT NULL,
    request_status ENUM('pending', 'accepted', 'rejected', 'not_requested') DEFAULT 'not_requested',
    salt VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE books (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(13) NOT NULL UNIQUE,
    publication_year INT NOT NULL,
    total_copies INT UNSIGNED NOT NULL,
    available_copies INT UNSIGNED NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE transactions (
    transaction_id INT NOT NULL AUTO_INCREMENT,
    user_id INT,
    book_id INT,
    status ENUM('checkout_requested', 'checkout_accepted', 'checkout_rejected', 'checkin_rejected', 'checkin_requested', 'returned') NOT NULL,
    checkout_time DATETIME,
    checkin_time DATETIME,
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);