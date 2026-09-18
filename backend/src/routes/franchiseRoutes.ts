import { Router, type Request, type Response } from "express";
import { FranchiseService, FranchiseError, type FranchiseAccess } from "../services/FranchiseService.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();
const service = new FranchiseService();
router.use(requireAuth);

type Operation = (a: FranchiseAccess, req: Request) => Promise<any>;

function handle(operation: Operation, table?: string | ((req: Request) => string)) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const a = await service.access((req as any).user.id, (req as any).user.role);
      const tableName = typeof table === "function" ? table(req) : table;
      const isUpdate = req.method === "PATCH" || req.method === "DELETE";
      const old = null;
      const data = await operation(a, req);
      if (tableName) {
        await logAudit(
          req,
          req.method === "DELETE" ? "DELETE" : isUpdate ? "UPDATE" : "INSERT",
          tableName,
          data?.id || (req.params.id as string),
          old,
          data
        );
      }
      res.status(req.method === "POST" && !req.path.includes("resend") && !req.path.includes("send-credentials") ? 201 : 200).json(data);
    } catch (error) {
      if (!(error instanceof FranchiseError)) console.error("[Franchise request]", error);
      res.status(error instanceof FranchiseError ? error.status : 500).json({
        message: error instanceof FranchiseError ? error.message : "Could not complete the franchise request."
      });
    }
  };
}

const param = (req: Request, key: string) => String(req.params[key] || "");

router.post("/sales/bulk", handle((a, req) => service.bulkCreateSales(a, req.body?.rows), "franchise_sales"));
router.get("/sales", handle(a => service.getSales(a)));
router.post("/sales", handle((a, req) => service.createSale(a, req.body), "franchise_sales"));

router.get("/bootstrap", handle(a => service.bootstrap(a)));
router.get("/overview", handle(a => service.getOverview(a)));
router.get("/directory", handle((a, req) => service.getDirectory(a, typeof req.query.q === "string" ? req.query.q : undefined)));
router.get("/products-summary", handle(a => service.getProductsSummary(a)));

router.get("/plans", handle(a => service.getPlans(a)));
router.post("/plans", handle((a, req) => service.createPlan(a, req.body), "franchise_plans"));
router.patch("/plans/:id", handle((a, req) => service.updatePlan(a, param(req, "id"), req.body), "franchise_plans"));
router.delete("/plans/:id", handle((a, req) => service.deletePlan(a, param(req, "id")), "franchise_plans"));

router.post("/franchises", handle((a, req) => service.register(a, req.body), "franchises"));
router.patch("/franchises/:id", handle((a, req) => service.updateFranchise(a, param(req, "id"), req.body), "franchises"));
router.delete("/franchises/:id", handle((a, req) => service.deleteFranchise(a, param(req, "id")), "franchises"));
router.post("/franchises/:id/enable-logins", handle((a, req) => service.enableRoleLogins(a, param(req, "id")), "franchise_users"));
router.post("/franchises/:id/send-credentials", handle((a, req) => service.resendCredentials(a, param(req, "id")), "franchises"));
router.post("/franchises/:id/resend-credentials", handle((a, req) => service.resendCredentials(a, param(req, "id")), "franchises"));

export default router;
