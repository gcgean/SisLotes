"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLpEvento1700000000026 = void 0;
class CreateLpEvento1700000000026 {
    constructor() {
        this.name = "CreateLpEvento1700000000026";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lp_evento (
        id SERIAL PRIMARY KEY,
        visitor_id VARCHAR(40),
        session_id VARCHAR(40),
        tipo VARCHAR(20) NOT NULL,
        secao VARCHAR(40),
        cta VARCHAR(40),
        referrer TEXT,
        utm_source VARCHAR(80),
        utm_medium VARCHAR(80),
        utm_campaign VARCHAR(80),
        device VARCHAR(20),
        user_agent TEXT,
        ip VARCHAR(50),
        duracao INTEGER,
        scroll_pct INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lp_evento_created ON lp_evento(created_at)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lp_evento_tipo ON lp_evento(tipo)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lp_evento_session ON lp_evento(session_id)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS lp_evento`);
    }
}
exports.CreateLpEvento1700000000026 = CreateLpEvento1700000000026;
