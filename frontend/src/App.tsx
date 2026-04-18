import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { PopupProvider } from "./contexts/PopupContext";
import { AjustesPage } from "./pages/AjustesPage";
import { ClienteFormPage, ClientesPage } from "./pages/ClientesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FinanceiroLocacaoDetalhePage } from "./pages/FinanceiroLocacaoDetalhePage";
import { FinanceiroPage } from "./pages/FinanceiroPage";
import {
  LocacaoDetailPage,
  LocacaoNovaPage,
  LocacoesPage,
} from "./pages/LocacoesPage";
import { LoginPage } from "./pages/LoginPage";
import { MovimentacoesPage } from "./pages/MovimentacoesPage";
import { TrajeFormPage, TrajesPage } from "./pages/TrajesPage";

export default function App() {
  return (
    <BrowserRouter>
      <PopupProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mobile" element={<LoginPage mobileEntry />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/novo" element={<ClienteFormPage />} />
          <Route path="/clientes/:id" element={<ClienteEdit />} />
          <Route path="/trajes" element={<TrajesPage />} />
          <Route path="/trajes/novo" element={<TrajeFormPage />} />
          <Route path="/trajes/:id" element={<TrajeEdit />} />
          <Route path="/locacoes" element={<LocacoesPage />} />
          <Route path="/locacoes/nova" element={<LocacaoNovaPage />} />
          <Route path="/locacoes/:id" element={<LocacaoDetailRoute />} />
          <Route path="/ajustes" element={<AjustesPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route
            path="/financeiro/:locacaoId"
            element={<FinanceiroLocacaoDetalheRoute />}
          />
          <Route path="/movimentacoes" element={<MovimentacoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </PopupProvider>
    </BrowserRouter>
  );
}

function ClienteEdit() {
  const { id } = useParams();
  return <ClienteFormPage id={id} />;
}

function TrajeEdit() {
  const { id } = useParams();
  return <TrajeFormPage id={id} />;
}

function LocacaoDetailRoute() {
  const { id } = useParams();
  return id ? <LocacaoDetailPage id={id} /> : null;
}

function FinanceiroLocacaoDetalheRoute() {
  return <FinanceiroLocacaoDetalhePage />;
}
