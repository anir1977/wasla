import { OrderTable } from "@/components/order-table";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CHAQUE CONVERSATION COMPTE</div>
          <h1>Vos commandes</h1>
          <p>De « Salam » à « commande confirmée », suivez chaque étape.</p>
        </div>
      </div>
      <OrderTable />
    </>
  );
}
