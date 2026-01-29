import Database from "@tauri-apps/plugin-sql";

export async function checkSchema() {
    try {
        const db = await Database.load("sqlite:stock.db");

        console.log("Checking brand_types schema:");
        const btInfo = await db.select("PRAGMA table_info(brand_types)");
        console.log(JSON.stringify(btInfo, null, 2));

        console.log("Checking type_numbers schema:");
        const tnInfo = await db.select("PRAGMA table_info(type_numbers)");
        console.log(JSON.stringify(tnInfo, null, 2));

    } catch (e) {
        console.error("Error checking schema:", e);
    }
}

// Since we cannot easily run this standalone without Tauri context,
// I will instead modify App.tsx temporarily to run this check on mount for debugging.
