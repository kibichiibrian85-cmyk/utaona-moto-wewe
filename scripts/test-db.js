
require("dotenv").config();

const pool = require("../db");

async function testDatabase() {
  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name,
        version() AS postgres_version
    `);

    console.log("DATABASE CONNECTION SUCCESSFUL");
    console.log("Database:", result.rows[0].database_name);
    console.log("Server time:", result.rows[0].server_time);
    console.log("PostgreSQL:", result.rows[0].postgres_version);
  } catch (error) {
    console.error("DATABASE CONNECTION FAILED");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabase();
