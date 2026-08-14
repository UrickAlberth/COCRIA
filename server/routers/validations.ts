import { z } from "zod";
import { protectedProcedure, coordinatorProcedure, router } from "../_core/trpc";
import {
  createValidation,
  updateValidation,
  getProjectValidations,
  getPendingValidations,
  getValidationsByStatus,
  updateProjectStatus,
} from "../db";

const STAGE = z.enum(["planning", "sources", "production"]);

// project.status the project must currently be in for a stage to be submittable
const SUBMIT_FROM_STATUS = {
  planning: "draft",
  sources: "planning_validated",
  production: "sources_validated",
} as const;

// project.status to move to once a stage's validation is submitted
const SUBMIT_TO_STATUS = {
  planning: "awaiting_planning_validation",
  sources: "awaiting_sources_validation",
  // there is no dedicated "awaiting production validation" status; entering
  // production also unlocks the Recursos tab, matching the module's existing unlock rule
  production: "in_production",
} as const;

// project.status once a stage's validation is approved (+ which module unlocks next)
const APPROVE_TO = {
  planning: { status: "planning_validated", module: "sources" },
  sources: { status: "sources_validated", module: "production" },
  production: { status: "completed", module: "completed" },
} as const;

// project.status to revert to when a stage's validation is rejected (back to the previous checkpoint, not all the way to draft)
const REJECT_TO = {
  planning: { status: "draft", module: "planning" },
  sources: { status: "planning_validated", module: "sources" },
  production: { status: "sources_validated", module: "production" },
} as const;

export const validationsRouter = router({
  // Submit a project stage for validation
  submit: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      stage: STAGE,
    }))
    .mutation(async ({ input }) => {
      const result = await createValidation(input.projectId, input.stage, 0); // 0 = awaiting assignment to a reviewer

      await updateProjectStatus(input.projectId, SUBMIT_TO_STATUS[input.stage], input.stage);

      return result;
    }),

  // Get validations for a project
  getProjectValidations: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await getProjectValidations(input.projectId);
    }),

  // Pending validations across all projects (coordinator queue)
  listPending: coordinatorProcedure.query(async () => {
    return await getPendingValidations();
  }),

  // Approved/rejected validations across all projects (coordinator queue history)
  listByStatus: coordinatorProcedure
    .input(z.object({ status: z.enum(["approved", "rejected"]) }))
    .query(async ({ input }) => {
      return await getValidationsByStatus(input.status);
    }),

  // Approve a validation (coordinator only)
  approve: coordinatorProcedure
    .input(z.object({
      validationId: z.number(),
      projectId: z.number(),
      stage: STAGE,
      comments: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateValidation(input.validationId, "approved", ctx.user.id, input.comments);

      const target = APPROVE_TO[input.stage];
      await updateProjectStatus(input.projectId, target.status, target.module);

      return { success: true };
    }),

  // Reject a validation (coordinator only)
  reject: coordinatorProcedure
    .input(z.object({
      validationId: z.number(),
      projectId: z.number(),
      stage: STAGE,
      comments: z.string().min(10, "Comentário deve ter pelo menos 10 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateValidation(input.validationId, "rejected", ctx.user.id, input.comments);

      const target = REJECT_TO[input.stage];
      await updateProjectStatus(input.projectId, target.status, target.module);

      return { success: true };
    }),
});
