import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FloatingContact } from "@/components/site/floating-contact";
import { PaymentsSection } from "@/components/site/payments-section";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/constants";
import { getDictionary, normalizeLocale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { buildQrDataUrl } from "@/lib/qr";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  return {
    title: t.payments.title,
    description: t.payments.subtitle,
    alternates: { canonical: "/payments" },
  };
}

/** Pagina de metodos de pago: efectivo, Cash App y Zelle (sin tarjetas de credito). */
export default async function PaymentsPage() {
  const qrDataUrl = await buildQrDataUrl(BUSINESS.cashAppUrl);

  return (
    <>
      <SiteHeader />
      <main className="pb-8">
        <div className="container pt-10">
          <Button asChild variant="ghost" size="sm" className="no-print">
            <Link href="/">
              <ArrowLeft className="size-4" />
              {BUSINESS.name}
            </Link>
          </Button>
        </div>
        <PaymentsSection qrDataUrl={qrDataUrl} className="pt-4 pb-14" />
      </main>
      <SiteFooter />
      <FloatingContact />
    </>
  );
}