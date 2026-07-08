import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getVendorById } from "@/lib/shop/shop.api";
import { ProductDetail } from "@/components/shop/ProductDetail";

interface PageProps {
  params: Promise<{ productSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);
  if (!product) return { title: "Product not found — Jovi Mall" };
  return {
    title: `${product.title} — Jovi Mall`,
    description: product.desc,
    openGraph: {
      title: product.title,
      description: product.desc,
      images: product.images.slice(0, 1),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { productSlug } = await params;
  const product = await getProductBySlug(productSlug);
  if (!product) notFound();
  const vendor = await getVendorById(product.vendorId);
  if (!vendor) notFound();

  return <ProductDetail product={product} vendor={vendor} />;
}
