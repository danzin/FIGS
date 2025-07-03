"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTickerRoutes = createTickerRoutes;
const express_1 = require("express");
function createTickerRoutes(tickerController) {
    const router = (0, express_1.Router)();
    router.post("/add", tickerController.addTicker);
    router.delete("/:sourceKey", tickerController.removeTicker);
    router.get("/", tickerController.listTickers);
    // router.get("/supported", tickerController.getSupportedOptions); Unavailable until I decide how to handle it
    router.get("/validate/:coinId", tickerController.validateCoin);
    return router;
}
//# sourceMappingURL=tickerRoutes.js.map