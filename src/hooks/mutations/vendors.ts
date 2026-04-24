// Re-export vendor mutation hooks from the combined queries/vendors module.
// The audited mutations live alongside the query hooks there; this barrel
// exists so pages can import mutations from the conventional location.

export {
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  useCreateVendorEvaluation,
} from '../queries/vendors'
export type { Vendor, VendorEvaluation } from '../queries/vendors'
