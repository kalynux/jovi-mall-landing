import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVendorBySlug } from "@/lib/shop/shop.api";
import { VendorStore } from "@/components/shop/VendorStore";

interface PageProps {
  params: Promise<{ vendorSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { vendorSlug } = await params;
  const vendor = await getVendorBySlug(vendorSlug);
  if (!vendor) return { title: "Store not found — Jovi Mall" };
  return {
    title: `${vendor.name} — Jovi Mall`,
    description: vendor.desc,
  };
}

export default async function VendorPage({ params }: PageProps) {
  const { vendorSlug } = await params;
  const vendor = await getVendorBySlug(vendorSlug);
  if (!vendor) notFound();
  return <VendorStore vendor={vendor} />;
}
