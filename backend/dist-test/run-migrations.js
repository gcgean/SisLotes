"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const data_source_1 = require("./db/data-source");
data_source_1.AppDataSource.initialize()
    .then(async (ds) => {
    const ran = await ds.runMigrations({ transaction: "all" });
    if (ran.length === 0) {
        console.log("Nenhuma migration pendente.");
    }
    else {
        console.log(`${ran.length} migration(s) aplicada(s): ${ran.map((m) => m.name).join(", ")}`);
    }
    await ds.destroy();
    process.exit(0);
})
    .catch((err) => {
    console.error("Erro ao executar migrations:", err);
    process.exit(1);
});
