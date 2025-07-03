"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatusRoutes = createStatusRoutes;
const express_1 = require("express");
function createStatusRoutes(statusController) {
    const router = (0, express_1.Router)();
    router.get("/health", statusController.getHealth);
    router.get("/status", statusController.getSchedulerStatus);
    router.post("/trigger/:sourceKey", statusController.triggerSource);
    return router;
}
//# sourceMappingURL=statusRoutes.js.map