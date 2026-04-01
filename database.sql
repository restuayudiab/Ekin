-- PJLP Database Schema
-- Created for E-Lapor PJLP Application

CREATE DATABASE IF NOT EXISTS pjlp_db;
USE pjlp_db;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    idPjlp VARCHAR(255),
    jabatan VARCHAR(255),
    satuanKerja VARCHAR(255),
    unitKerja VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(255),
    whatsapp VARCHAR(255),
    pengawasName VARCHAR(255),
    pengawasNip VARCHAR(255),
    kepalaSatuanName VARCHAR(255),
    kepalaSatuanNip VARCHAR(255)
);

-- Table: suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255),
    userName VARCHAR(255),
    content TEXT,
    createdAt VARCHAR(255)
);

-- Table: activities
CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255),
    date VARCHAR(255),
    startTime VARCHAR(255),
    endTime VARCHAR(255),
    description TEXT,
    type VARCHAR(255),
    location VARCHAR(255),
    isLibur TINYINT(1) DEFAULT 0,
    isMfd TINYINT(1) DEFAULT 0,
    isNormal TINYINT(1) DEFAULT 0,
    mfdLocation VARCHAR(255),
    photos TEXT
);

-- Initial Data for users (Mock Data)
INSERT IGNORE INTO users (id, name, idPjlp, jabatan, satuanKerja, unitKerja, username, password, role, pengawasName, pengawasNip, kepalaSatuanName, kepalaSatuanNip) 
VALUES 
('1', 'AGUNG SUMARDI', '80339397', 'PETUGAS TEKNISI AC', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'agung', 'password123', 'admin', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020'),
('2', 'BUDI SANTOSO', '80339400', 'PETUGAS TEKNISI LISTRIK', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'budi', 'password123', 'user', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020');

-- Initial Data for activities (Mock Data)
INSERT IGNORE INTO activities (id, userId, date, startTime, endTime, description, type, isLibur, isNormal, photos)
VALUES
('1', '1', '2025-10-30', '', '', 'LIBUR', '2', 1, 0, '[]'),
('2', '1', '2025-10-31', '', '', 'LIBUR', '2', 1, 0, '[]'),
('3', '1', '2025-11-01', '07:00', '15:00', '- Pelaksanaan Apel Pagi rutin\n- Monitoring unit AC dan Menyalakan unit ac Area Terminal pulogebang.\n- maintenance of indoor air conditioning filter changes in the 2nd floor area of departure.\n- ISHOMA\n- Giat Cleaning filter AC dan mengecek unit AC seluruh area', '1', 0, 1, '["https://picsum.photos/seed/ac1/200/200", "https://picsum.photos/seed/ac2/200/200"]');

INSERT IGNORE INTO activities (id, userId, date, startTime, endTime, description, type, isMfd, isNormal, mfdLocation, photos)
VALUES
('4', '1', '2025-11-03', '', '', 'MFD (Mental, Fisik dan Disiplin) RINDAM JAYA CONDET', '3', 1, 0, 'RINDAM JAYA CONDET', '[]');
