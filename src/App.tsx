/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Monitor, 
  Gamepad2, 
  Package, 
  Calculator, 
  TrendingUp, 
  Plus, 
  Minus,
  Search, 
  Printer, 
  X,
  Check,
  CreditCard,
  Smartphone,
  Gift,
  Receipt,
  ReceiptText,
  ArrowRightLeft,
  History,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronRight,
  MousePointer2,
  Keyboard,
  Headphones,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Rental, Expense, AnalyticsSummary, Loss } from './types';
import SplashScreen from './components/SplashScreen';

const DEFAULT_PC_BLOCKED_IMAGE_URL = process.env.REACT_APP_PC_BLOCKED_IMAGE || '/image/AOD.png';

export default function App() {
  console.log('App component render');
  const API_BASE = process.env.REACT_APP_API_URL?.trim() || '';
  const DEFAULT_REMOTE_BASE = 'https://server-pc-fq7x.onrender.com';

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const remoteUrl = `${API_BASE || DEFAULT_REMOTE_BASE}${path}`;
    const localCandidates = [
      `http://localhost:4000${path}`,
      `http://127.0.0.1:4000${path}`,
      `${window.location.protocol}//${window.location.hostname}:4000${path}`,
    ];

    const errors: string[] = [];

    const attemptFetch = async (url: string) => {
      try {
        const res = await fetch(url, options);
        if (res.ok) {
          console.debug('[apiFetch] success', url);
          return res;
        }
        const msg = `HTTP ${res.status}`;
        errors.push(`${url}: ${msg}`);
        console.warn('[apiFetch] non-ok', url, msg);
        return null;
      } catch (err) {
        errors.push(`${url}: ${err}`);
        console.warn('[apiFetch] failed candidate', url, err);
        return null;
      }
    };

    // First try remote server (Render), then local fallback.
    const remoteResult = await attemptFetch(remoteUrl);
    if (remoteResult) return remoteResult;

    for (const url of localCandidates) {
      const result = await attemptFetch(url);
      if (result) return result;
    }

    throw new Error(`apiFetch failed for ${path}. Tried: ${localCandidates.join(', ')}, ${remoteUrl}. Details: ${errors.join(' | ')}`);
  };

  const fetchPcLiveFrame = async (pcId: string) => {
    if (!pcId) return;
    try {
      const res = await apiFetch(`/api/pc/${pcId}/video/live`);
      if (!res.ok) {
        throw new Error(`Request failed ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'No video data');
      }
      if (!json.data || !json.data.image_data) {
        setPcLiveError('No hay frame disponible. Esperando datos...');
        setPcLiveFrame('');
        return;
      }

      const frame = json.data.image_data as string;
      setPcLiveFrame(frame.startsWith('data:image') ? frame : `data:image/png;base64,${frame}`);
      setPcLiveError('');
    } catch (error: any) {
      const message = (error?.message) ? error.message : 'Stream fetch error';
      setPcLiveError(message);
      setPcLiveFrame('');
    }
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const [isSplashTimeout, setIsSplashTimeout] = useState(false);
  const [isSplashError, setIsSplashError] = useState(false);
  console.log('DBG App state pre', { isLoaded, isSplashTimeout, isSplashError });
  const [activeTab, setActiveTab] = useState<'pos' | 'rentals' | 'inventory' | 'accounting' | 'analytics' | 'losses' | 'sales'>('pos');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });

  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  const [selectedLossItemId, setSelectedLossItemId] = useState<string>('');
  const [lossItemType, setLossItemType] = useState<'product' | 'equipment' | 'peripheral'>('product');
  const [lossType, setLossType] = useState<'merma' | 'scrap' | 'damage'>('merma');
  const [equipmentFullLoss, setEquipmentFullLoss] = useState<boolean>(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceTargetId, setMaintenanceTargetId] = useState<number | null>(null);
  const [maintenanceAll, setMaintenanceAll] = useState(false);
  const [maintenanceValue, setMaintenanceValue] = useState<number>(0);

  const [adjustmentValue, setAdjustmentValue] = useState<number>(15);

  const [processLocks, setProcessLocks] = useState<Record<string, boolean>>({});
  const [processSpinner, setProcessSpinner] = useState(false);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const showWarning = (title: string, message: string) => {
    setWarningModal({ isOpen: true, title, message });
  };

  useEffect(() => {
    if (isLoaded) return;

    const timer = setTimeout(() => {
      setIsSplashTimeout(true);
      setIsSplashError(true);
      setIsLoaded(true);
      console.warn('Splash timeout fallback triggered; forcing main UI render');
      showNotification('Tiempo de carga excedido. UI principal activada.', 'info');
    }, 9000);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => {
      setIsSplashTimeout(true);
      setIsLoaded(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  const [taecelSalesData, setTaecelSalesData] = useState<any[]>([]);
  const [pendingPairCodes, setPendingPairCodes] = useState<Array<{pc_id: string; expires_at: string}>>([]);
  const [discoveredPCs, setDiscoveredPCs] = useState<Array<{pc_id: string; pc_name?: string; status: string; last_seen: string; assigned?: boolean; isOnline?: boolean}>>([]);
  const unassignedDiscoveredPCs = useMemo(() => discoveredPCs.filter((pc) => !pc.assigned), [discoveredPCs]);
  const [pcListMode, setPcListMode] = useState<'unassigned'|'all'>('unassigned');
  const visiblePcList = useMemo(() => (pcListMode === 'unassigned' ? unassignedDiscoveredPCs : discoveredPCs), [pcListMode, unassignedDiscoveredPCs, discoveredPCs]);
  const equipmentOnlineByPcId = useMemo(() => {
    const map: Record<string, boolean> = {};
    discoveredPCs.forEach((pc) => {
      map[pc.pc_id] = !!pc.isOnline;
    });
    return map;
  }, [discoveredPCs]);
  const [selectedPcIdForForm, setSelectedPcIdForForm] = useState<string>('');
  const [selectedPcNameForForm, setSelectedPcNameForForm] = useState<string>('');
  const [isSelectPcModalOpen, setIsSelectPcModalOpen] = useState(false);
  const [pcNameEdits, setPcNameEdits] = useState<Record<string,string>>({});

  const [pcLiveId, setPcLiveId] = useState<string>('');
  const [pcLiveFrame, setPcLiveFrame] = useState<string>('');
  const [pcLiveError, setPcLiveError] = useState<string>('');
  const [isPcLiveActive, setIsPcLiveActive] = useState(false);

  useEffect(() => {
    if (!isPcLiveActive || !pcLiveId) {
      setPcLiveFrame('');
      return;
    }

    const interval = window.setInterval(() => {
      fetchPcLiveFrame(pcLiveId);
    }, 1500);

    fetchPcLiveFrame(pcLiveId);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPcLiveActive, pcLiveId]);

  const [taecelSalesLoading, setTaecelSalesLoading] = useState(false);
  const [taecelSalesError, setTaecelSalesError] = useState<string | null>(null);

  const [salesViewFilter, setSalesViewFilter] = useState<'all' | 'consumables' | 'rentals' | 'taecel'>('all');

  const [products, setProducts] = useState<Product[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [peripherals, setPeripherals] = useState<any[]>([]);
  const [activeRentals, setActiveRentals] = useState<Rental[]>([]);
  const [rentalItems, setRentalItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [losses, setLosses] = useState<Loss[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    revenue: 0,
    expenses: 0,
    investment: 0,
    execution: 0,
    losses: 0,
    profit: 0,
    todayRevenue: 0,
    todayProfit: 0
  });
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

  const safeJsonParse = (value: any) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const combinedSales = useMemo(() => {
    const localSales = sales.map(sale => ({
      id: sale.id,
      referencia: `#${sale.id}`,
      producto: sale.type === 'rental' ? 'Renta/Servicio' : 'Consumible',
      codigo: '-',
      monto: sale.total,
      respuesta: 'SUCCESS',
      tipo: sale.type === 'rental' ? 'Renta' : 'Consumible',
      source: 'local',
      fecha: sale.timestamp ? new Date(sale.timestamp).toLocaleString() : ''
    }));

    const taecelSalesProcessed = taecelSalesData.map(item => {
      const requestBody = safeJsonParse(item.request_body);
      const responseBody = safeJsonParse(item.response_body);
      const producto = requestBody?.producto || requestBody?.product || requestBody?.Servicio || requestBody?.service || requestBody?.servicio || 'Taecel';
      const monto = requestBody?.monto || requestBody?.amount || requestBody?.Monto || 0;
      const codigo = responseBody?.code || responseBody?.codigo || responseBody?.statusCode || responseBody?.status || responseBody?.Status || '-';
      const respuesta = item.status || responseBody?.status || responseBody?.Status || responseBody?.message || responseBody?.mensaje || '-';
      return {
        id: item.transid,
        referencia: item.transid || '-',
        producto,
        codigo,
        monto: typeof monto === 'number' ? monto : Number(monto) || 0,
        respuesta,
        tipo: 'Taecel',
        source: 'taecel',
        fecha: item.created_at ? new Date(item.created_at).toLocaleString() : ''
      };
    });

    return [...localSales, ...taecelSalesProcessed];
  }, [sales, taecelSalesData]);

  const filteredCombinedSales = useMemo(() => {
    return combinedSales.filter(item => {
      if (salesViewFilter === 'all') return true;
      if (salesViewFilter === 'consumables') return item.tipo === 'Consumible';
      if (salesViewFilter === 'rentals') return item.tipo === 'Renta';
      if (salesViewFilter === 'taecel') return item.source === 'taecel';
      return true;
    });
  }, [combinedSales, salesViewFilter]);

  const runProcess = async (key: string, action: () => Promise<void>) => {
    if (processLocks[key]) {
      showWarning('Proceso en curso', 'Hay una operación igual ejecutándose ahora. Por favor espera que termine.');
      return;
    }

    setProcessLocks(prev => ({ ...prev, [key]: true }));
    setProcessSpinner(true);

    try {
      await action();
    } catch (error: any) {
      console.error('Error en proceso:', key, error);
      showNotification(error?.message || 'Ocurrió un error durante el proceso', 'error');
    } finally {
      setProcessLocks(prev => ({ ...prev, [key]: false }));
      setProcessSpinner(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<{ type: 'product' | 'equipment' | 'peripheral'; data: any } | null>(null);
  const [formCategory, setFormCategory] = useState<string>('product');
  const [rentalTimeType, setRentalTimeType] = useState<'unlimited' | 'timed'>('unlimited');
  const [rentalLimitMinutes, setRentalLimitMinutes] = useState<number | ''>(60);
  const [selectedEquipmentIdForRental, setSelectedEquipmentIdForRental] = useState<string>('');
  const [rentalModal, setRentalModal] = useState<{ 
    type: 'start' | 'complete' | 'add-item' | 'adjust-time';
    rental?: Rental;
    rentalType?: 'PC' | 'Console';
    identifier?: string;
    equipmentId?: number;
    adjustmentType?: 'add' | 'reduce';
  } | null>(null);
  const [showTicket, setShowTicket] = useState<{ type: string; data: any } | null>(null);
  const [taecelError, setTaecelError] = useState<string | null>(null);
  const [taecelVerified, setTaecelVerified] = useState<boolean>(true);
  const [taecelCatalog, setTaecelCatalog] = useState<any[]>([]);
  const [taecelCatalogLoading, setTaecelCatalogLoading] = useState(false);
  const [taecelCatalogError, setTaecelCatalogError] = useState<string | null>(null);
  const [taecelCatalogCount, setTaecelCatalogCount] = useState<{productos: number; carriers: number; categorias: number; bolsas: number; productosUnicos: number; byGroup?: Record<string, number> } | null>(null);
  const [taecelCatalogLastUpdatedAt, setTaecelCatalogLastUpdatedAt] = useState<string | null>(null);
  const [taecelCarrierRules, setTaecelCarrierRules] = useState<any[]>([]);
  const [isTaecelCatalogModalOpen, setIsTaecelCatalogModalOpen] = useState(false);
  const [taecelTxnStatus, setTaecelTxnStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [taecelTxnMessage, setTaecelTxnMessage] = useState<string>('');
  const [taecelCatalogFilter, setTaecelCatalogFilter] = useState<'Todos' | 'Recargas' | 'Servicios' | 'Catálogo' | 'Gift Cards' | 'Otros'>('Todos');
  const [taecelCatalogSearch, setTaecelCatalogSearch] = useState('');
  const [taecelCatalogLimit, setTaecelCatalogLimit] = useState(40);
  const [selectedTaecelProvider, setSelectedTaecelProvider] = useState<string>('');
  const [selectedTaecelProduct, setSelectedTaecelProduct] = useState<any>(null);
  const [selectedTaecelDenomination, setSelectedTaecelDenomination] = useState<number | null>(null);
  const [selectedTaecelManualAmount, setSelectedTaecelManualAmount] = useState<number | ''>('');
  const [taecelCustomerPhone, setTaecelCustomerPhone] = useState('');
  const [taecelProductCode, setTaecelProductCode] = useState('');

  const normalizeTaecelPhone = (raw: string): string => {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    // TODO: mantiene solo el número nacional de 10 dígitos.
    // - Quita +52, 52 previo, o 1 prefijo tipo SMS +52 1
    if (digits.startsWith('52') && digits.length > 10) digits = digits.slice(2);
    if (digits.startsWith('1') && digits.length === 11) digits = digits.slice(1);
    // Si aún queda código internacional con 011, 001, etc, elimina hasta 10 finales
    if (digits.length > 10) digits = digits.slice(-10);
    return digits;
  };

  const [selectedAdminMethod, setSelectedAdminMethod] = useState<string>('');
  const [adminFormValues, setAdminFormValues] = useState<Record<string, string>>({});
  const [taecelAdminLoading, setTaecelAdminLoading] = useState(false);
  const [taecelAdminError, setTaecelAdminError] = useState<string | null>(null);
  const [taecelAdminResult, setTaecelAdminResult] = useState<any>(null);
  const [taecelHistory, setTaecelHistory] = useState<any[]>([]);

  const [expenseFilter, setExpenseFilter] = useState<string>('all');
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);

  const taecelAdminMethods = [
    { key: 'getBalance', label: 'Consultar Saldo', description: 'Obtiene saldos de bolsas Taecel. No requiere parámetros.' },
    { key: 'getProducts', label: 'Productos', description: 'Obtiene catálogo actualizado de productos Taecel.' },
    { key: 'consultarSaldo', label: 'Consultar Saldo Detalle', description: 'Consulta saldo por producto/operador y código.' },
    { key: 'getSales', label: 'Reporte de Ventas', description: 'Obtiene ventas, requiere fecha y bolsa.' },
    { key: 'getReports', label: 'Reportes Adicionales', description: 'Obtiene reportes usando fecha y lastId.' },
    { key: 'getBancosCte', label: 'Bancos Cte', description: 'Obtiene datos de bancos de la cuenta; normalmente no requiere parámetros.' },
    { key: 'urlReporteCompra', label: 'URL de Reporte de Compra', description: 'Obtiene URL para reporte de compra.' },
    { key: 'traspasoPago', label: 'Traspaso de Pago', description: 'Realiza traspaso entre bolsas; requiere parámetros de traspaso.' },
    { key: 'StatusTXN', label: 'StatusTXN', description: 'Consulta estado de transacción por transid.' },
    { key: 'RequestTXN', label: 'RequestTXN', description: 'Genera transacción de servicio/recarga.' },
    { key: 'ProgRequestTXN', label: 'ProgRequestTXN', description: 'Programar transacción con fecha futura.' },
    { key: 'CancelProgRequestTXN', label: 'CancelProgRequestTXN', description: 'Cancelar transacción programada.' }
  ];

  const formatTaecelValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const renderTaecelData = (data: any) => {
    if (data === null || data === undefined) return <p className="text-xs text-gray-500">Sin datos</p>;

    if (Array.isArray(data)) {
      if (data.length === 0) return <p className="text-xs text-gray-500">Arreglo vacío</p>;
      const columns = Object.keys(data[0] || {});
      return (
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse border border-gray-200">
            <thead>
              <tr>
                {columns.map(col => <th key={col} className="border p-1 bg-gray-100 text-left">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 30).map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map(col => (
                    <td key={col} className="border p-1 break-words max-w-[150px]">{formatTaecelValue(item[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 30 && <p className="text-[10px] text-gray-500 mt-2">Mostrando 30 de {data.length} filas.</p>}
        </div>
      );
    }

    if (typeof data === 'object') {
      return (
        <div className="space-y-2 text-xs">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="font-black text-gray-600 w-28">{key}</span>
              <span className="whitespace-pre-wrap">{formatTaecelValue(value)}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-xs">{String(data)}</p>;
  };
  const [serviceModal, setServiceModal] = useState<{
    isOpen: boolean;
    product: Product | null;
    details: string;
    customAmount: string;
    loading: boolean;
    targetRentalId?: number | null;
  }>({
    isOpen: false,
    product: null,
    details: '',
    customAmount: '',
    loading: false,
    targetRentalId: null
  });

  // Taecel catalog state managed desde la API. Se elimina la lógica de filtros de servicios digitales heredados.

  const [taecelLastUpdate, setTaecelLastUpdate] = useState<number | null>(null);
  const [taecelProducts, setTaecelProducts] = useState<any[]>([]);
  const [selectedTaecelOperator, setSelectedTaecelOperator] = useState<string>('');
  // Se usa selectedTaecelProduct (objeto) declarado arriba en el scope principal de datos Taecel.
  const [formPeripherals, setFormPeripherals] = useState<{ type: string; name: string; cost: number; quantity: number }[]>([]);
  const [expandedEquipment, setExpandedEquipment] = useState<number[]>([]);
  const [reportRange, setReportRange] = useState({
    start: new Date().toLocaleDateString('en-CA'),
    end: new Date().toLocaleDateString('en-CA')
  });
  const [reportData, setReportData] = useState<any>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [timeOverAlert, setTimeOverAlert] = useState<Rental | null>(null);
  const [alertedRentalIds, setAlertedRentalIds] = useState<Set<number>>(new Set());
  const [showPcLiveView, setShowPcLiveView] = useState(false);
  const blockedScreenImageUrl = process.env.REACT_APP_PC_BLOCKED_IMAGE || '/pc-blocked.png';

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 5, delayMs = 500) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await apiFetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (err) {
        if (i === retries) throw err;
        await wait(delayMs);
      }
    }
    throw new Error('fetchWithRetry failed');
  };

  useEffect(() => {
    const start = async () => {
      await wait(400); // asegúrate de que el servidor tenga un arranque mínimo
      await fetchData();
    };

    start().catch(console.warn);
    const interval = setInterval(fetchData, 3000); // Actualiza cada 3 segundos para refresco casi en tiempo real
    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    if (activeRentals.length === 0) return;

    activeRentals.forEach(async (rental) => {
      if (rental.limit_minutes > 0 && !rental.is_frozen) {
        const start = new Date(rental.start_time.replace(' ', 'T')).getTime();
        const limitMs = rental.limit_minutes * 60000;
        const end = start + limitMs;
        const now = Date.now();

        if (now >= end && !alertedRentalIds.has(rental.id)) {
          setTimeOverAlert(rental);
          setAlertedRentalIds(prev => new Set(prev).add(rental.id));

          try {
            await fetch(`/api/rentals/${rental.id}/timeout`, { method: 'POST' });
            await fetchData();
          } catch (e) {
            console.warn('Error al timeout rental', e);
          }
        }
      }
    });
  }, [activeRentals, alertedRentalIds]);

  useEffect(() => {
    if (rentalModal?.type === 'complete' && rentalModal.rental) {
      fetch(`/api/rentals/${rentalModal.rental.id}/items`)
        .then(res => res.json())
        .then(data => setRentalItems(data));
    } else {
      setRentalItems([]);
    }
    
    if (rentalModal?.type === 'start' && rentalModal.equipmentId) {
      setSelectedEquipmentIdForRental(rentalModal.equipmentId.toString());
    } else {
      setSelectedEquipmentIdForRental('');
    }
  }, [rentalModal]);

  useEffect(() => {
    if (showTicket) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showTicket]);

  useEffect(() => {
    const parseDate = (d: string) => {
      if (!d) return new Date();
      if (d.includes(' ') && !d.includes('T')) return new Date(d.replace(' ', 'T') + 'Z');
      return new Date(d);
    };

    const interval = setInterval(() => {
      const now = new Date().getTime();
      activeRentals.forEach(rental => {
        if (rental.limit_minutes > 0 && !rental.is_frozen) {
          const start = parseDate(rental.start_time).getTime();
          const limitMs = rental.limit_minutes * 60000;
          const end = start + limitMs;
          
          if (now >= end && !alertedRentalIds.has(rental.id)) {
            setTimeOverAlert(rental);
            setAlertedRentalIds(prev => new Set(prev).add(rental.id));
          }
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRentals, alertedRentalIds]);

  const openCompleteModal = (rental: Rental) => {
    fetch(`/api/rentals/${rental.id}/items`)
      .then(res => res.json())
      .then(data => {
        setRentalItems(data);
        setRentalModal({ type: 'complete', rental });
      });
  };

  const [loadingOperators, setLoadingOperators] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    amount: number;
    title: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    amount: 0,
    title: '',
    onConfirm: () => {}
  });
  const [amountReceived, setAmountReceived] = useState<string>('');

  useEffect(() => {
    if (paymentModal.isOpen) {
      setAmountReceived(paymentModal.amount.toFixed(2));
    }
  }, [paymentModal.isOpen, paymentModal.amount]);

  // Taecel catalog load tracking
  useEffect(() => {
    console.log('Taecel catalog state triggered', {
      serviceModalOpen: serviceModal.isOpen,
      taecelError: !!taecelError,
      taecelCatalogCount: taecelCatalogCount?.productos || 0
    });
  }, [serviceModal.isOpen, taecelError, taecelCatalogCount]);

  const fetchData = async () => {
    try {
      const [prodRes, equipRes, periRes, rentRes, expRes, summaryRes, lossRes, salesRes] = await Promise.all([
        fetchWithRetry('/api/products'),
        fetchWithRetry('/api/equipment'),
        fetchWithRetry('/api/peripherals'),
        fetchWithRetry('/api/rentals/active'),
        fetchWithRetry('/api/expenses'),
        fetchWithRetry('/api/analytics/summary'),
        fetchWithRetry('/api/losses'),
        fetchWithRetry('/api/sales')
      ]);
      
      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        setProducts(Array.isArray(prodJson) ? prodJson : Array.isArray(prodJson?.data) ? prodJson.data : []);
      }
      if (equipRes.ok) {
        const equipJson = await equipRes.json();
        setEquipment(Array.isArray(equipJson) ? equipJson : Array.isArray(equipJson?.data) ? equipJson.data : []);
      }
      if (periRes.ok) {
        const periJson = await periRes.json();
        setPeripherals(Array.isArray(periJson) ? periJson : Array.isArray(periJson?.data) ? periJson.data : []);
      }
      if (rentRes.ok) {
        const rentJson = await rentRes.json();
        setActiveRentals(Array.isArray(rentJson) ? rentJson : Array.isArray(rentJson?.data) ? rentJson.data : []);
      }
      if (expRes.ok) {
        const expJson = await expRes.json();
        setExpenses(Array.isArray(expJson) ? expJson : Array.isArray(expJson?.data) ? expJson.data : []);
      }
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson?.data || summaryJson || summary);
      }
      if (lossRes.ok) {
        const lossJson = await lossRes.json();
        setLosses(Array.isArray(lossJson) ? lossJson : Array.isArray(lossJson?.data) ? lossJson.data : []);
      }
      if (salesRes.ok) {
        const salesJson = await salesRes.json();
        setSales(Array.isArray(salesJson) ? salesJson : Array.isArray(salesJson?.data) ? salesJson.data : []);
      }
      const pairRes = await apiFetch('/api/pc/pending-pair-codes');
      if (pairRes.ok) {
        const pairData = await pairRes.json();
        setPendingPairCodes(pairData.data || []);
      }

      const discoveredRes = await apiFetch('/api/pc/discovered?freshnessMinutes=0&onlineThresholdMinutes=1');
      let discovered: Array<any> = [];
      if (discoveredRes.ok) {
        const discoveredData = await discoveredRes.json();
        discovered = discoveredData.data || [];
      }
      console.log('[Rentas PC/Consolas] discovered PCs', discovered);

      const unassignedRes = await apiFetch('/api/pc/unassigned?freshnessMinutes=0&onlineThresholdMinutes=1');
      let unassigned: Array<any> = [];
      if (unassignedRes.ok) {
        const unassignedData = await unassignedRes.json();
        unassigned = (unassignedData.data || []).map((pc: any) => ({ ...pc, assigned: false }));
      }

      const discoveredById = new Map<string, any>();
      discovered.forEach((pc: any) => discoveredById.set(pc.pc_id, { ...pc, assigned: Boolean(pc.equipment_id) }));
      unassigned.forEach((pc: any) => {
        if (!discoveredById.has(pc.pc_id)) {
          discoveredById.set(pc.pc_id, { ...pc, assigned: false });
        }
      });

      const allDiscovered = Array.from(discoveredById.values());

      // Mostrar todas las PCs detectadas (incluyendo ya asignadas), para uso en inventario y actualizaciones.
      setDiscoveredPCs(allDiscovered);
      setPcNameEdits((prev) => {
        const next = { ...prev };
        allDiscovered.forEach((item: any) => {
          if (item.pc_id && !next[item.pc_id]) {
            next[item.pc_id] = item.pc_name || item.pc_id;
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const normalizeTaecelCategory = (item: any) => {
    const catRaw = String(item?.Categoria || item?.categoria || item?.category || item?.type || '').trim();
    const carrierIdRaw = item?.CarrierID || item?.carrierID || item?.idOperador || item?.IDOperador || item?.idCarrier || item?.id || item?.ID || 0;
    const idOperador = Number(carrierIdRaw);
    const idProducto = String(item?.idProducto || item?.ID || item?.codigo || item?.Codigo || '').trim();
    const operador = String(item?.operador || item?.Operador || item?.Carrier || item?.carrier || item?.Nombre || item?.nombre || '').trim();
    const producto = String(item?.producto || item?.Producto || '').trim();

    if (!Number.isNaN(idOperador) && idOperador > 0) {
      if (idOperador < 100) return 'Recargas';
      if (idOperador >= 100 && idOperador < 200) return 'Servicios';
      if (idOperador >= 200 && idOperador < 300) return 'Gift Cards';
      if (idOperador >= 300) return 'Catálogo';
    }

    const combined = (catRaw + ' ' + idProducto + ' ' + operador + ' ' + producto).toLowerCase();

    if (/recarga|top up|telcel|movistar|at\&t|unefon|bait|virgin|weex/.test(combined)) return 'Recargas';
    if (/servicio|service|pago|factura|cfe|telmex|sky|dish|izzi|naturgy|totalplay|aguakan|predial|infonavit/.test(combined)) return 'Servicios';
    if (/gift|regalo|cupon|netflix|spotify|xbox|playstation|amazon|google|steam|uber|didi|nintendo|hbo|disney|cines|cinemex|cinepolis|rappi/.test(combined)) return 'Gift Cards';
    if (/catalog|catálogo|tienda|avon|mary kay|tupperware|natura|jafra|oriflame|belcorp|herbalife|stanhome|cklass|price shoes|andrea|shelo nabel|terramar|fuller/.test(combined)) return 'Catálogo';

    return 'Otros';
  };

  const claimPairCode = async (pcId: string) => {
    try {
      const res = await apiFetch('/api/pc/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pc_id: pcId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotification(`No se pudo reclamar PC ${pcId}: ${data.error || 'error desconocido'}`, 'error');
        return;
      }
      const message = data.message === 'already claimed' ? 'ya estaba reclamada en el inventario' : 'reclamada y añadida al inventario';
      showNotification(`PC ${pcId} ${message}`, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification(`Error al reclamar PC ${pcId}`, 'error');
    }
  };

  const sendPcCommand = async (pcId: string, command: string, payload: any = {}) => {
    try {
      const res = await fetch(`/api/pc/${pcId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Comando ${command} enviado a ${pcId}`, 'success');
        return true;
      }
      showNotification(`No se pudo enviar comando a ${pcId}: ${data.error || 'error'}`, 'error');
      return false;
    } catch (err) {
      console.error(err);
      showNotification(`Error enviando comando a ${pcId}`, 'error');
      return false;
    }
  };

  const updatePcAgentName = async (pcId: string, pcNameInput: string) => {
    const pcNameTrimmed = pcNameInput.trim();
    if (!pcNameTrimmed) {
      showNotification('El nombre de PC no puede estar vacío', 'error');
      return false;
    }

    const duplicate = discoveredPCs.find((pc) => pc.pc_id !== pcId && pc.pc_name?.toLowerCase() === pcNameTrimmed.toLowerCase());
    if (duplicate) {
      showNotification(`El nombre '${pcNameTrimmed}' ya está en uso por ${duplicate.pc_id}`, 'error');
      return false;
    }

    try {
      const res = await apiFetch('/api/pc/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pc_id: pcId, pc_name: pcNameTrimmed })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotification(`No se pudo actualizar nombre de PC ${pcId}: ${data.error || 'error desconocido'}`, 'error');
        return false;
      }

      setDiscoveredPCs((prev) => prev.map((pc) => (pc.pc_id === pcId ? { ...pc, pc_name: pcNameTrimmed } : pc)));
      setPcNameEdits((prev) => ({ ...prev, [pcId]: pcNameTrimmed }));
      if (selectedPcIdForForm === pcId) setSelectedPcNameForForm(pcNameTrimmed);
      await fetchData(); // refetch inmediato para reflejar en toda la UI y en tiempo real
      showNotification(`Nombre de PC ${pcId} actualizado a '${pcNameTrimmed}'`, 'success');
      return true;
    } catch (err) {
      console.error(err);
      showNotification(`Error actualizando nombre de PC ${pcId}`, 'error');
      return false;
    }
  };

  const computeTaecelCatalogStats = (catalog: any[]) => {
    const counts = { Recargas: 0, Servicios: 0, Catálogo: 0, 'Gift Cards': 0, Otros: 0 };
    const uniqueProducts = new Set<string>();
    const carrierSet = new Set<string>();

    catalog.forEach((item: any) => {
      if (isExcludedProvider(item)) return;

      const key = normalizeTaecelCategory(item) || 'Otros';
      counts[key] = (counts[key] || 0) + 1;
      const id = String(item.Codigo || item.codigo || item.idProducto || item.producto || item.ID || item.id || '').trim();
      if (id) uniqueProducts.add(id);

      const carrier = String(item.Carrier || item.carrier || item.operador || item.Operador || '').trim();
      if (carrier) carrierSet.add(carrier);
    });

    const keys = Object.keys(counts) as Array<keyof typeof counts>;

    return {
      bolsas: 0,
      categorias: keys.filter(k => counts[k] > 0).length,
      carriers: carrierSet.size,
      productos: keys.reduce((sum, key) => sum + counts[key], 0),
      productosUnicos: uniqueProducts.size,
      byGroup: counts
    };
  };

  const getTaecelProductByCode = (code: string) => {
    if (!code) return null;
    const normalized = String(code).trim();
    return taecelCatalog.find((item: any) => {
      const itemCode = String(item.Codigo || item.codigo || item.idProducto || item.producto || '').trim();
      return itemCode.toUpperCase() === normalized.toUpperCase();
    }) || null;
  };

  const getCarrierByProduct = (product: any) => {
    if (!product) return null;
    const carrierId = String(product.CarrierID || product.idOperador || product.IDOperador || '').trim();
    const carrierName = String(product.Carrier || product.operador || product.Operador || '').trim();

    let carrier = taecelCarrierRules.find((c: any) => {
      return String(c.ID || c.id || '').trim() === carrierId || String(c.CarrierID || c.carrierID || '').trim() === carrierId;
    });

    if (!carrier && carrierName) {
      carrier = taecelCarrierRules.find((c: any) => String(c.Nombre || c.nombre || '').trim().toLowerCase() === carrierName.toLowerCase());
    }

    return carrier || null;
  };

  const validateTaecelProductFields = (product: any, carrier: any, referencia: string, monto: number | null) => {
    if (!product) return { valid: false, message: 'Producto no encontrado' };

    if (!carrier || !Array.isArray(carrier.Campos)) {
      // fallback: referencia numérico 10-32
      if (!referencia || !/^[0-9]{10,32}$/.test(referencia)) {
        return { valid: false, message: 'Referencia inválida: debe ser numérica entre 10 y 32 dígitos' };
      }
      return { valid: true };
    }

    const refField = carrier.Campos.find((f: any) => String(f.Campo || '').toLowerCase() === 'referencia');
    if (!refField) {
      return { valid: true };
    }

    if (String(refField.Obligatorio || '0') === '1' && !referencia) {
      return { valid: false, message: 'Referencia es obligatoria para este producto' };
    }

    const minLen = Number(refField.Min || 0);
    const maxLen = Number(refField.Max || 999);
    const referenceDigits = String(referencia || '');

    if (referenceDigits.length < minLen || referenceDigits.length > maxLen) {
      return { valid: false, message: `Referencia debe tener entre ${minLen} y ${maxLen} caracteres` };
    }

    if (String(refField.Formato || '').trim() === '1' || String(refField.Formato || '').toLowerCase().includes('numeric')) {
      if (!/^[0-9]+$/.test(referenceDigits)) {
        return { valid: false, message: 'Referencia debe ser numérica según formato del carrier' };
      }
    }

    if (String(refField.iniCero || '0') === '0' && referenceDigits.startsWith('0')) {
      return { valid: false, message: 'Referencia no puede comenzar con cero' };
    }

    if (carrier.Tipo === '1' || String(carrier.Tipo || '').trim() === '1') {
      // Monto libre puede ser 0
    } else if (monto === null || monto <= 0) {
      return { valid: false, message: 'Monto debe ser mayor a 0 para este producto' };
    }

    return { valid: true };
  };

  const isExcludedProvider = (item: any) => {
    if (!item || typeof item !== 'object') return true;

    const providerCandidates = [
      item.Provider,
      item.provider,
      item.Proveedor,
      item.proveedor,
      item.Carrier,
      item.carrier
    ]
      .filter(Boolean)
      .map((value: any) => String(value).trim().toLowerCase());

    const hasProductCode = Boolean(
      item.Codigo || item.codigo || item.idProducto || item.ID || item.id || item.producto || item.Producto
    );

    // No excluir si hay código válido (producto real)
    if (hasProductCode) {
      return false;
    }

    // Excluir items de metadata o con proveedor taecel genérico sin producto.
    return providerCandidates.some(p => p === 'taecel' || p === 'taecel api');
  };

  const filteredTaecelCatalog = useMemo(() => {
    const group = taecelCatalogFilter;
    const search = taecelCatalogSearch.trim().toLowerCase();

    return taecelCatalog.filter((item: any) => {
      if (isExcludedProvider(item)) return false;

      const category = normalizeTaecelCategory(item);
      if (group !== 'Todos' && category !== group) return false;

      if (!search) return true;

      const tokens = [
        item.idProducto, item.producto, item.Codigo, item.codigo,
        item.operador, item.Operador, item.Carrier, item.carrier,
        item.idOperador, item.IDOperador, item.categoria, item.Categoria,
      ].filter(Boolean).map((v: any) => String(v).toLowerCase()).join(' ');

      return tokens.includes(search);
    });
  }, [taecelCatalog, taecelCatalogFilter, taecelCatalogSearch]);

  const handleTaecelCatalogScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 180) {
      setTaecelCatalogLimit(prev => Math.min(prev + 40, filteredTaecelCatalog.length));
    }
  };

  const refreshTaecel = async () => {
    setTaecelError('La actualización manual está deshabilitada. La API se actualiza automáticamente cada 25 horas.');
    setTimeout(() => setTaecelError(null), 5000);
  };

  useEffect(() => {
    // Cargar catálogo Taecel al iniciar la aplicación
    if (!taecelCatalog.length && !taecelCatalogLoading) {
      fetchTaecelCatalog().catch(err => {
        console.warn('Taecel: error al cargar catálogo inicial:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTaecelCatalog = async () => {
    await runProcess('fetchTaecelCatalog', async () => {
      setTaecelCatalogLoading(true);
      setTaecelCatalogError(null);

      try {
        const countResp = await fetch(`/api/taecel/admin/getProductsCount`);
        const countData = await countResp.json();
        if (!countResp.ok || !countData.success) {
          throw new Error(countData.message || 'Error count');
        }

        const statusResp = await fetch('/api/taecel/status');
        const statusData = await statusResp.json();
        if (statusResp.ok && statusData.success) {
          const timestamp = statusData.lastCacheTimestamp || statusData.lastBackupTimestamp || statusData.lastCacheTimestamp;
          if (timestamp) {
            const parsed = Number(timestamp) >= 0 ? new Date(Number(timestamp)) : new Date(timestamp);
            if (!Number.isNaN(parsed.getTime())) {
              setTaecelCatalogLastUpdatedAt(parsed.toLocaleString());
            }
          }
        }

        const serverStats = countData.items || {
          productos: 0,
          carriers: 0,
          categorias: 0,
          bolsas: 0,
          productosUnicos: 0
        };

        const resp = await fetch(`/api/taecel/admin/getProducts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.message || 'Error getProducts');
        }

        const result = data.data || data;
        const products =
          Array.isArray(result.productos) ? result.productos :
          Array.isArray(result.data?.productos) ? result.data.productos :
          Array.isArray(result.data) ? result.data :
          Array.isArray(result) ? result :
          [];

        if (!Array.isArray(products)) {
          setTaecelCatalog([]);
          throw new Error('Respuesta no contuvo array productos');
        }

        setTaecelCatalog(products);

        const carriers = Array.isArray(result.carriers)
          ? result.carriers
          : Array.isArray(result.data?.carriers)
          ? result.data.carriers
          : [];
        setTaecelCarrierRules(carriers);

        const derivedStats = computeTaecelCatalogStats(products);
        setTaecelCatalogCount({
          ...derivedStats,
          bolsas: serverStats.bolsas ?? 0,
          categorias: derivedStats.categorias || serverStats.categorias || 0,
          carriers: serverStats.carriers ?? derivedStats.carriers ?? carriers.length ?? 0,
          productos: derivedStats.productos,
          productosUnicos: derivedStats.productosUnicos
        });

      } catch (err: any) {
        setTaecelCatalogError(err.message || 'Error al cargar catálogo Taecel');
        setTaecelCatalog([]);
        setTaecelCatalogCount(null);
        throw err;
      } finally {
        setTaecelCatalogLoading(false);
      }
    });
  };

  const taecelAdminMethodFields: Record<string, Array<{ key: string; label: string; type: string; placeholder: string }>> = {
    RequestTXN: [
      { key: 'producto', label: 'Producto', type: 'text', placeholder: 'TEL010' },
      { key: 'numero', label: 'Número a recargar', type: 'text', placeholder: '5512345678' },
      { key: 'referencia', label: 'Referencia', type: 'text', placeholder: 'ORD-1234' }
    ],
    getSales: [
      { key: 'fecha', label: 'Fecha', type: 'date', placeholder: '2026-03-25' },
      { key: 'bolsa', label: 'Bolsa', type: 'number', placeholder: '1' }
    ],
    getReports: [
      { key: 'fecha', label: 'Fecha', type: 'date', placeholder: '2026-03-25' },
      { key: 'lastid', label: 'Last ID', type: 'text', placeholder: '0' }
    ],
    traspasoPago: [
      { key: 'tipo_bolsa', label: 'Tipo de Bolsa', type: 'number', placeholder: '1' },
      { key: 'tipo', label: 'Tipo', type: 'number', placeholder: '1' },
      { key: 'folio', label: 'Folio', type: 'text', placeholder: 'FOL-123' },
      { key: 'monto', label: 'Monto', type: 'number', placeholder: '10.00' },
      { key: 'nota', label: 'Nota', type: 'text', placeholder: 'Cambio de saldo' },
      { key: 'clienteID', label: 'ClienteID', type: 'text', placeholder: '12345' }
    ],
    StatusTXN: [
      { key: 'transid', label: 'TransID', type: 'text', placeholder: 'abcde12345' }
    ],
    CancelProgRequestTXN: [
      { key: 'transid', label: 'TransID', type: 'text', placeholder: 'abcde12345' }
    ],
    RegistroCuenta: [
      { key: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Juan' },
      { key: 'apellidos', label: 'Apellidos', type: 'text', placeholder: 'Pérez' },
      { key: 'correo', label: 'Correo', type: 'email', placeholder: 'correo@ejemplo.com' },
      { key: 'telefono', label: 'Teléfono', type: 'text', placeholder: '5512345678' },
      { key: 'nomcom', label: 'Nombre Comercial', type: 'text', placeholder: 'Mi Negocio' },
      { key: 'forzar', label: 'Forzar Activación', type: 'checkbox', placeholder: '' }
    ]
  };

  const renderTaecelAdminForm = () => {
    if (!selectedAdminMethod) return null;

    const fields = taecelAdminMethodFields[selectedAdminMethod] || [];

    return (
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-xs text-gray-500">Este método no requiere parámetros o usa formulario genérico.</div>
        ) : fields.map(field => (
          <div key={field.key} className="text-xs">
            <label className="block text-gray-500 mb-1 font-black uppercase tracking-widest">{field.label}</label>
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={adminFormValues[field.key] === 'true'}
                onChange={(e) => setAdminFormValues(prev => ({ ...prev, [field.key]: e.target.checked ? 'true' : 'false' }))}
                className="h-4 w-4"
              />
            ) : (
              <input
                type={field.type}
                value={adminFormValues[field.key] || ''}
                onChange={(e) => setAdminFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        ))}

        {selectedAdminMethod === 'getProducts' && (
          <div className="text-xs text-gray-500">Nota: puede usar {"{ force: true }"} para forzar refrescar desde Taecel.</div>
        )}
      </div>
    );
  };

  const executeAdminMethod = async () => {
    if (!selectedAdminMethod) {
      setTaecelAdminError('Selecciona primero un método de administración');
      return;
    }

    const payload: Record<string, any> = {};
    const values = adminFormValues;

    if (values.fecha) payload.fecha = values.fecha;
    if (values.bolsa) payload.bolsa = values.bolsa;
    if (values.fechaInicio) payload.fechaInicio = values.fechaInicio;
    if (values.fechaFin) payload.fechaFin = values.fechaFin;
    if (values.transid) payload.transid = values.transid;
    if (values.monto) payload.monto = Number(values.monto);
    if (values.idBanco) payload.idBanco = values.idBanco;
    if (values.idProducto) payload.idProducto = values.idProducto;
    if (values.referencia) payload.referencia = values.referencia;
    if (values.carrier) payload.carrier = values.carrier;
    if (values.producto) payload.producto = values.producto;
    if (values.tipo_bolsa) payload.tipo_bolsa = Number(values.tipo_bolsa);
    if (values.tipo) payload.tipo = Number(values.tipo);
    if (values.folio) payload.folio = values.folio;
    if (values.nota) payload.nota = values.nota;
    if (values.clienteID) payload.clienteID = values.clienteID;
    if (values.numero) payload.numero = values.numero;
    if (values.telefono) payload.numero = values.telefono;

    await callTaecelAdminEndpoint(selectedAdminMethod, payload);
  };

  const callTaecelAdminEndpoint = async (endpoint: string, payload: Record<string, any> = {}) => {
    setTaecelAdminLoading(true);
    setTaecelAdminError('');
    setTaecelAdminResult(null);

    try {
      const response = await fetch(`/api/taecel/admin/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error en admin Taecel');
      }

      setTaecelAdminResult(data);
      return data;
    } catch (error: any) {
      setTaecelAdminError(error?.message || 'Error de administración de Taecel');
      return null;
    } finally {
      setTaecelAdminLoading(false);
    }
  };

  const fetchTaecelHistory = async (status: 'ALL' | 'SUCCESS' | 'FAILED' | 'PENDING' = 'ALL') => {
    try {
      const query = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`/api/taecel/transactions${query}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTaecelHistory(data.data || []);
      } else {
        setTaecelHistory([]);
        showNotification('No se pudo cargar historial Taecel', 'error');
      }
    } catch (error) {
      setTaecelHistory([]);
      showNotification('Error al consultar historial Taecel', 'error');
    }
  };

  const generateReport = async () => {
    try {
      const res = await fetch(`/api/analytics/report?start=${reportRange.start}&end=${reportRange.end}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        setIsReportModalOpen(true);
      } else {
        showNotification('Error al generar reporte', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const filteredProducts = useMemo(() => {
    const allItems = products.map(p => {
      const equip = (p.category === 'pc' || p.category === 'console') 
        ? equipment.find(e => e.name === p.name) 
        : null;
      return { 
        ...p, 
        itemType: 'product' as const,
        equipmentId: equip?.id,
        pcId: equip?.pc_id || '',
        status: equip?.status || 'available'
      };
    });

    return allItems.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeTab === 'pos') {
        return matchesSearch && p.category === 'product';
      }

      if (activeTab === 'inventory') {
        const allowedInventoryCategories = ['product', 'pc', 'console'];
        const isAllowed = allowedInventoryCategories.includes(p.category);
        const matchesCategory = selectedCategory === 'all' ? isAllowed : p.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, activeTab]);

  const deleteInventoryItem = (id: number, type: 'product' | 'equipment' | 'peripheral') => {
    const endpoint = type === 'product' ? `/api/products/${id}` : type === 'equipment' ? `/api/equipment/${id}` : `/api/peripherals/${id}`;
    setConfirmModal({
      isOpen: true,
      title: `Eliminar ${type === 'product' ? 'Producto' : type === 'equipment' ? 'Equipo' : 'Periférico'}`,
      message: '¿Estás seguro de eliminar este item del inventario?',
      onConfirm: async () => {
        try {
          const res = await fetch(endpoint, { method: 'DELETE' });
          if (res.ok) {
            fetchData();
            showNotification('Item eliminado', 'success');
          } else {
            const text = await res.text();
            showNotification(`Error al eliminar: ${text}`, 'error');
            console.error('Delete entry failed:', endpoint, res.status, text);
          }
        } catch (e) {
          console.error('Delete entry request failed:', endpoint, e);
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const handleEditSave = async (type: 'product' | 'equipment' | 'peripheral', id: number, data: any) => {
    const endpoint = type === 'product' ? `/api/products/${id}` : type === 'equipment' ? `/api/equipment/${id}` : `/api/peripherals/${id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        // If it's an equipment, we might also need to update the product table if they are synced by name
        if (type === 'equipment') {
          const relatedProduct = products.find(p => p.name === editingItem?.data.name);
          if (relatedProduct) {
            await fetch(`/api/products/${relatedProduct.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                name: data.name, 
                category: data.type.toLowerCase(), 
                price: relatedProduct.price, 
                cost: data.cost, 
                stock: 1 
              })
            });
          }
        }
        
        fetchData();
        showNotification('Cambios guardados', 'success');
        setEditingItem(null);
      } else {
        showNotification('Error al guardar cambios', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const deleteExpense = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Gasto',
      message: '¿Estás seguro de eliminar este gasto?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchData();
            showNotification('Gasto eliminado', 'success');
          } else {
            showNotification('Error al eliminar', 'error');
          }
        } catch (e) {
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const deleteLoss = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Registro',
      message: '¿Estás seguro de eliminar este registro de baja?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/losses/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchData();
            showNotification('Registro eliminado', 'success');
          } else {
            showNotification('Error al eliminar', 'error');
          }
        } catch (e) {
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const deleteSale = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Venta',
      message: '¿Estás seguro de eliminar esta venta? Esto afectará los reportes contables.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchData();
            showNotification('Venta eliminada', 'success');
          } else {
            showNotification('Error al eliminar', 'error');
          }
        } catch (e) {
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const deleteRentalItem = (itemId: number, rentalId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Quitar Item',
      message: '¿Eliminar este producto de la renta?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/rentals/items/${itemId}`, { method: 'DELETE' });
          if (res.ok) {
            fetch(`/api/rentals/${rentalId}/items`)
              .then(res => res.json())
              .then(data => setRentalItems(data));
            showNotification('Item quitado', 'success');
          } else {
            showNotification('Error al quitar item', 'error');
          }
        } catch (e) {
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleSale = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    setAmountReceived('');
    setPaymentModal({
      isOpen: true,
      amount: total,
      title: 'Venta Directa',
      onConfirm: async () => {
        await runProcess('confirm-sale', async () => {
          try {
            const response = await fetch('/api/sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ total, items: cart.map(i => ({ ...i.product, quantity: i.quantity })) })
            });
            if (response.ok) {
              const data = await response.json();
              setShowTicket({ type: 'Venta Directa', data: { id: data.id, items: cart, total, date: new Date().toLocaleString() } });
              setCart([]);
              fetchData();
              showNotification('Venta realizada con éxito', 'success');
            } else {
              showNotification('Error al procesar la venta', 'error');
            }
          } catch (e) {
            showNotification('Error de conexión al vender', 'error');
          }
        });
      }
    });
  };

  const startRental = async (type: 'PC' | 'Console', identifier: string, advance: number, limitMinutes: number = 0, peripheralIds: number[] = [], equipmentId?: number) => {
    try {
      const response = await fetch('/api/rentals/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          identifier, 
          advance_payment: advance, 
          limit_minutes: limitMinutes,
          peripheral_ids: peripheralIds,
          equipment_id: equipmentId
        })
      });
      if (response.ok) {
        const data = await response.json();
        setShowTicket({ 
          type: 'Inicio de Renta', 
          data: { 
            id: data.id, 
            identifier, 
            type, 
            advance, 
            limitMinutes,
            start: new Date().toLocaleString()
          } 
        });
        fetchData();
        showNotification('Renta iniciada', 'success');
      } else {
        showNotification('Error al iniciar la renta', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const completeRental = async (rental: Rental, finalPrice: number, items: any[] = [], timeCost: number = 0) => {
    const amountToPay = finalPrice - rental.advance_payment;
    
    setAmountReceived('');
    setPaymentModal({
      isOpen: true,
      amount: Math.max(0, amountToPay),
      title: `Renta: ${rental.identifier}`,
      onConfirm: async () => {
        await runProcess('complete-rental', async () => {
          try {
            const response = await fetch(`/api/rentals/${rental.id}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ total_price: finalPrice })
            });
            if (response.ok) {
              setShowTicket({ 
                type: 'Ticket de Renta', 
                data: { 
                  id: rental.id, 
                  identifier: rental.identifier, 
                  type: rental.type,
                  start: rental.start_time,
                  end: new Date().toLocaleString(),
                  advance: rental.advance_payment,
                  total: finalPrice,
                  due: finalPrice - rental.advance_payment,
                  items: items,
                  timeCost: timeCost
                } 
              });
              fetchData();
              showNotification('Renta completada', 'success');
            } else {
              showNotification('Error al completar la renta', 'error');
            }
          } catch (e) {
            showNotification('Error de conexión', 'error');
          }
        });
      }
    });
  };

  const freezeRental = async (rental: Rental) => {
    const isFreezing = !rental.is_frozen;

    try {
      const res = await fetch(`/api/rentals/${rental.id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          is_frozen: isFreezing
        })
      });
      if (res.ok) {
        fetchData();
        showNotification(isFreezing ? 'Renta congelada' : 'Renta reanudada', 'success');
      } else {
        showNotification('Error al actualizar estado', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const unblockEquipment = async (equipmentId: number | null) => {
    if (!equipmentId) return;
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchData();
        showNotification('Equipo desbloqueado', 'success');
      } else {
        showNotification('No se pudo desbloquear el equipo', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const addTimeToRental = async (id: number, minutes?: number) => {
    let mins = minutes;
    if (mins === undefined) {
      const input = prompt('Minutos a agregar:');
      if (!input || isNaN(parseInt(input))) return;
      mins = parseInt(input);
    }
    
    try {
      const res = await fetch(`/api/rentals/${id}/add-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: mins })
      });
      if (res.ok) {
        fetchData();
        showNotification(`Se agregaron ${mins} minutos`, 'success');
      } else {
        showNotification('Error al agregar tiempo', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const reduceTimeToRental = async (id: number, minutes?: number) => {
    let mins = minutes;
    if (mins === undefined) {
      const input = prompt('Minutos a reducir:');
      if (!input || isNaN(parseInt(input))) return;
      mins = parseInt(input);
    }

    try {
      const res = await fetch(`/api/rentals/${id}/reduce-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: mins })
      });
      if (res.ok) {
        fetchData();
        showNotification(`Se redujeron ${mins} minutos`, 'success');
      } else {
        showNotification('Error al reducir tiempo', 'error');
      }
    } catch (e) {
      showNotification('Error de conexión', 'error');
    }
  };

  const cancelRental = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Renta',
      message: '¿Estás seguro de cancelar esta renta? No se generará cobro y el equipo quedará libre.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/rentals/${id}/cancel`, { method: 'POST' });
          if (res.ok) {
            fetchData();
            showNotification('Renta cancelada', 'info');
          } else {
            showNotification('Error al cancelar', 'error');
          }
        } catch (e) {
          showNotification('Error de conexión', 'error');
        }
      }
    });
  };

  const cancelOrFinishRental = async (rental: Rental) => {
    const option = window.prompt('Seleccione: 1) Terminar y cobrar, 2) Cancelar sin cobro', '1');
    if (!option) return;

    if (option.trim() === '1') {
      openCompleteModal(rental);
    } else if (option.trim() === '2') {
      await cancelRental(rental.id);
    } else {
      showNotification('Opción no válida', 'info');
    }
  };

  const updateRentalLimit = async (rentalId: number, limitMinutes: number) => {
    try {
      const response = await fetch(`/api/rentals/${rentalId}/limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_minutes: limitMinutes })
      });
      if (response.ok) {
        fetchData();
        showNotification('Límite de tiempo actualizado', 'success');
      }
    } catch (e) {
      console.error(e);
      showNotification('Error de conexión', 'error');
    }
  };

  const renderServiceModal = () => null;
  const renderDigitalServicesModal = () => null;

  const fetchTaecelSales = async () => {
    setTaecelSalesLoading(true);
    setTaecelSalesError(null);

    try {
      const response = await fetch('/api/taecel/transactions');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al cargar ventas Taecel');
      }

      setTaecelSalesData(result.data || []);
    } catch (error: any) {
      setTaecelSalesError(error.message || 'Error al obtener ventas Taecel');
      setTaecelSalesData([]);
    } finally {
      setTaecelSalesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchTaecelSales();
    }
  }, [activeTab]);

  useEffect(() => {
    setTaecelCatalogLimit(40);
  }, [taecelCatalogFilter, taecelCatalogSearch]);

  const renderTaecelCatalogModal = () => {
    if (!isTaecelCatalogModalOpen) return null;

    const providerGroups = filteredTaecelCatalog.reduce((map: Map<string, any[]>, item: any) => {
      const provider = String(item.operador || item.Operador || item.Carrier || item.carrier || item.Nombre || item.nombre || 'Otros').trim() || 'Otros';
      const arr = map.get(provider) || [];
      arr.push(item);
      map.set(provider, arr);
      return map;
    }, new Map<string, any[]>());

    const providerEntries = Array.from(providerGroups.entries()).sort(([a], [b]) => a.localeCompare(b));
    const providerItems = selectedTaecelProvider ? (providerGroups.get(selectedTaecelProvider) || []) : [];
    const priceOptions = Array.from(new Set<number>(
      providerItems
        .map((it: any) => Number(it.precio || it.Precio || it.Monto || it.monto || 0))
        .filter((v: number) => !Number.isNaN(v) && v > 0)
    )).sort((a, b) => a - b);

    const finalAmount = selectedTaecelDenomination || (Number(selectedTaecelManualAmount) > 0 ? Number(selectedTaecelManualAmount) : null);

    const handleConfirmService = () => {
      if (!selectedTaecelProvider) {
        showNotification('Selecciona un servicio primero', 'error');
        return;
      }
      if (!finalAmount || finalAmount <= 0) {
        showNotification('Ingresa o selecciona una cantidad válida', 'error');
        return;
      }
      if (!taecelCustomerPhone.trim()) {
        showNotification('Ingresa un teléfono o identificador válido', 'error');
        return;
      }

      showNotification(`Servicio ${selectedTaecelProvider} $${finalAmount} confirmado para ${taecelCustomerPhone}`, 'success');
      setSelectedTaecelProvider('');
      setSelectedTaecelDenomination(null);
      setSelectedTaecelManualAmount('');
      setTaecelCustomerPhone('');
      setIsTaecelCatalogModalOpen(false);
    };

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
        <div className="bg-white rounded-[32px] shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-black">Catálogo completo Taecel (API)</h3>
            <button onClick={() => setIsTaecelCatalogModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto h-[76vh]" onScroll={handleTaecelCatalogScroll}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={() => fetchTaecelCatalog()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase"
              >
                Refrescar catálogo Taecel
              </button>
              {taecelCatalogLoading && <span className="text-sm text-indigo-600 font-bold">Cargando...</span>}
              {taecelCatalogError && <span className="text-sm text-red-600 font-bold">{taecelCatalogError}</span>}
              {taecelCatalogLastUpdatedAt && (
                <span className="text-xs text-gray-500 ml-2">Última actualización: {taecelCatalogLastUpdatedAt}</span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <input
                value={taecelCatalogSearch}
                onChange={(e) => setTaecelCatalogSearch(e.target.value)}
                placeholder="Buscar producto, operador, código..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => { setTaecelCatalogSearch(''); setTaecelCatalogFilter('Recargas'); }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-black"
              >
                Reset
              </button>
            </div>

            {taecelCatalogCount && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4 text-xs">
                <span className="px-3 py-2 bg-gray-100 rounded-xl">Bolsas: {taecelCatalogCount.bolsas}</span>
                <span className="px-3 py-2 bg-gray-100 rounded-xl">Categorías: {taecelCatalogCount.categorias}</span>
                <span className="px-3 py-2 bg-gray-100 rounded-xl">Carriers: {taecelCatalogCount.carriers}</span>
                <span className="px-3 py-2 bg-gray-100 rounded-xl">Productos: {taecelCatalogCount.productos}</span>
                <span className="px-3 py-2 bg-gray-100 rounded-xl">Productos únicos: {taecelCatalogCount.productosUnicos}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4 text-xs">
              {Object.entries({
                Recargas: (taecelCatalogCount?.byGroup?.Recargas || 0),
                Servicios: (taecelCatalogCount?.byGroup?.Servicios || 0),
                Catálogo: (taecelCatalogCount?.byGroup?.Catálogo || 0),
                'Gift Cards': (taecelCatalogCount?.byGroup?.['Gift Cards'] || 0),
                Otros: (taecelCatalogCount?.byGroup?.Otros || 0)
              }).map(([label, value]) => (
                <div key={label} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
                  <p className="text-lg font-black text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-3">
              {['Todos', 'Recargas', 'Servicios', 'Catálogo', 'Gift Cards', 'Otros'].map((group) => (
                <button
                  key={group}
                  onClick={() => setTaecelCatalogFilter(group as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-black ${taecelCatalogFilter === group ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {group}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-500">Mostrando {Math.min(filteredTaecelCatalog.length, taecelCatalogLimit)} de {filteredTaecelCatalog.length}</span>
            </div>

            {providerEntries.length === 0 && (
              <div className="text-center p-6 text-gray-400">No hay servicios disponibles</div>
            )}

            {selectedTaecelProvider ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      setSelectedTaecelProvider('');
                      setSelectedTaecelDenomination(null);
                      setSelectedTaecelManualAmount('');
                      setTaecelCustomerPhone('');
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >← Cambiar servicio</button>
                  <span className="text-sm font-black">{selectedTaecelProvider}</span>
                </div>

                {priceOptions.length > 0 ? (
                  <>
                    <p className="text-xs text-gray-500 mb-2">Selecciona la cantidad disponible (API)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {priceOptions.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => {
                            setSelectedTaecelDenomination(amount);
                            const selectedItem = providerItems.find((it: any) => Number(it.precio || it.Precio || it.Monto || it.monto || 0) === amount);
                            if (selectedItem) {
                              const code = String(selectedItem.Codigo || selectedItem.codigo || selectedItem.idProducto || selectedItem.ID || selectedItem.id || selectedItem.producto || '').trim();
                              setTaecelProductCode(code);
                            } else {
                              setTaecelProductCode('');
                            }
                          }}
                          className={`px-2 py-2 rounded-lg text-xs font-bold ${selectedTaecelDenomination === amount ? 'bg-emerald-500 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'}`}
                        >{amount}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2">No hay montos automáticos en API; ingresa monto manual.</p>
                    <input
                      value={selectedTaecelManualAmount}
                      onChange={(e) => setSelectedTaecelManualAmount(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Monto"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div className="mb-3">
                  <input
                    value={taecelCustomerPhone}
                    onChange={(e) => setTaecelCustomerPhone(e.target.value)}
                    placeholder="Teléfono / número de cuenta (referencia principal)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="mb-3">
                  <input
                    value={taecelProductCode}
                    readOnly
                    placeholder="Código Taecel de producto (auto)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                  />
                </div>

                <button
                  disabled={taecelAdminLoading}
                  onClick={async () => {
                    const amount = selectedTaecelDenomination || (Number(selectedTaecelManualAmount) > 0 ? Number(selectedTaecelManualAmount) : null);
                    if (!selectedTaecelProvider) {
                      showNotification('Selecciona un servicio primero', 'error');
                      return;
                    }
                    if (!amount || amount <= 0) {
                      showNotification('Ingresa o selecciona una cantidad válida', 'error');
                      return;
                    }
                    if (!taecelCustomerPhone.trim()) {
                      showNotification('Ingresa un teléfono o identificador válido', 'error');
                      return;
                    }

                    const providerItems = filteredTaecelCatalog.filter((item: any) => {
                      const provider = String(item.operador || item.Operador || item.Carrier || item.carrier || item.Nombre || item.nombre || 'Otros').trim() || 'Otros';
                      return provider === selectedTaecelProvider;
                    });

                    const selectedProduct = providerItems.find((it: any) => {
                      const value = Number(it.precio || it.Precio || it.Monto || it.monto || 0);
                      return value === amount;
                    }) || selectedTaecelProduct || providerItems[0];

                    if (!selectedProduct) {
                      showNotification('No se encontró producto válido para este servicio', 'error');
                      return;
                    }

                    const productCode = taecelProductCode || String(
                      selectedProduct.Codigo ||
                      selectedProduct.codigo ||
                      selectedProduct.idProducto ||
                      selectedProduct.ID ||
                      selectedProduct.id ||
                      selectedProduct.producto ||
                      ''
                    ).trim();
                    // Campos catalogados de Taecel: CODIGO exacto (METODO getProducts) tiene prioridad.
                    const codigoTaecel = taecelProductCode || String(selectedProduct.Codigo || selectedProduct.codigo || selectedProduct.codigoTaecel || productCode).trim();
                    const finalProductCode = codigoTaecel || productCode;

                    if (!productCode) {
                      showNotification('Producto inválido, verifica el servicio seleccionado', 'error');
                      return;
                    }

                    const numeroNormalizado = normalizeTaecelPhone(taecelCustomerPhone);
                    if (!numeroNormalizado) {
                      showNotification('Teléfono/número inválido después de normalizar', 'error');
                      return;
                    }

                    const referencia = String(numeroNormalizado).replace(/\D/g, '');

                    const productMeta = getTaecelProductByCode(finalProductCode) || selectedProduct;
                    const carrierMeta = getCarrierByProduct(productMeta);
                    const validation = validateTaecelProductFields(productMeta, carrierMeta, referencia, amount);
                    if (!validation.valid) {
                      showNotification(validation.message || 'Error de validación', 'error');
                      return;
                    }

                    // Normaliza T10->TEL010 para productos Telcel según el catálogo de Taecel
                    const selectedProvider = String(selectedTaecelProvider || selectedProduct.operador || selectedProduct.Operador || selectedProduct.Carrier || selectedProduct.carrier || '').trim().toLowerCase();
                    let normalizedProductCode = finalProductCode.toUpperCase();

                    if ((selectedProvider.includes('telcel') || String(selectedProduct.idOperador || selectedProduct.IDOperador).trim() === '1') && /^T\d+$/i.test(normalizedProductCode)) {
                      const amountCode = Number(normalizedProductCode.slice(1));
                      if (!Number.isNaN(amountCode)) {
                        normalizedProductCode = `TEL${String(amountCode).padStart(3, '0')}`;
                      }
                    }

                    const payload: any = {
                      producto: normalizedProductCode,
                      referencia,
                      monto: amount
                    };

                    try {
                      setTaecelTxnStatus('pending');
                      setTaecelTxnMessage('Transacción en proceso...');

                      const result = await callTaecelAdminEndpoint('RequestTXN', payload);
                      if (result && result.success) {
                        setTaecelTxnStatus('success');
                        setTaecelTxnMessage(`Transacción Taecel confirmada: ${result.transid || 'OK'}`);
                        showNotification(`Transacción Taecel confirmada: ${result.transid || 'OK'}`, 'success');
                        setSelectedTaecelProvider('');
                        setSelectedTaecelDenomination(null);
                        setSelectedTaecelManualAmount('');
                        setTaecelCustomerPhone('');
                        setIsTaecelCatalogModalOpen(false);
                        fetchTaecelHistory();
                      } else {
                        const reason = result?.error || result?.message || 'falló sin razón clara';
                        setTaecelTxnStatus('error');
                        setTaecelTxnMessage(String(reason));
                        console.error('RequestTXN fallback error:', result);
                        showNotification(`Error Taecel: ${reason}`, 'error');
                      }
                    } catch (err: any) {
                      setTaecelTxnStatus('error');
                      setTaecelTxnMessage(err?.message || 'Error al procesar Taecel');
                      console.error('RequestTXN exception', err);
                      showNotification(`Error al procesar Taecel: ${err?.message || err}`, 'error');
                    } finally {
                      setTimeout(() => setTaecelTxnStatus('idle'), 5000);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-black ${taecelAdminLoading ? 'bg-gray-400 text-gray-100 cursor-wait' : 'bg-emerald-600 text-white'}`}
                >
                  {taecelAdminLoading ? 'Procesando...' : 'Confirmar datos'}
                </button>

                <div className="mt-3 w-full text-xs">
                  {taecelTxnStatus === 'pending' && (
                    <div className="flex items-center gap-2 p-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-700">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                      <span>{taecelTxnMessage}</span>
                    </div>
                  )}
                  {taecelTxnStatus === 'success' && (
                    <div className="p-2 bg-green-100 border border-green-300 rounded-lg text-green-700">
                      {taecelTxnMessage}
                    </div>
                  )}
                  {taecelTxnStatus === 'error' && (
                    <div className="p-2 bg-red-100 border border-red-300 rounded-lg text-red-700">
                      {taecelTxnMessage}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                {providerEntries.map(([provider, items]) => {
                  const firstItem = items[0] || {};
                  const imageUrl = firstItem.logotipo || firstItem.Logotipo || firstItem.logo || '';
                  const defaultAmount = Number(firstItem.precio || firstItem.Precio || firstItem.Monto || firstItem.monto || 0) || null;
                  const defaultCode = String(firstItem.Codigo || firstItem.codigo || firstItem.idProducto || firstItem.ID || firstItem.id || firstItem.producto || '').trim();
                  return (
                    <button
                      key={provider}
                      onClick={() => {
                        setSelectedTaecelProvider(provider);
                        setSelectedTaecelProduct(firstItem);
                        setSelectedTaecelDenomination(defaultAmount);
                        setSelectedTaecelManualAmount('');
                        setTaecelCustomerPhone('');
                        setTaecelProductCode(defaultCode);
                      }}
                      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={provider}
                              className="h-full w-full object-contain"
                              onError={(e) => {(e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/40?text=?';}}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No logo</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black">{provider}</p>
                          <p className="text-xs text-gray-500">{items.length} opciones</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">Selecciona este servicio para ver o ingresar cantidades</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMaintenanceModal = () => {
    if (!maintenanceMode) return null;

    const handleApply = async () => {
      try {
        const equipList = maintenanceAll ? equipment : equipment.filter(e => e.id === maintenanceTargetId);
        if (equipList.length === 0) {
          showNotification('Selecciona un equipo válido o activa Mantenimiento a todos', 'error');
          return;
        }

        for (const equip of equipList) {
          const amount = maintenanceValue > 0 ? maintenanceValue : equip.cost || 0;
          await fetch('/api/losses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              equipment_id: equip.id,
              quantity: 1,
              type: 'maintenance',
              reason: `Mantenimiento aplicado${maintenanceAll ? ' a todos' : ''}`,
              amount
            })
          });
        }

        fetchData();
        showNotification('Mantenimiento registrado como pérdida', 'success');
        setMaintenanceMode(false);
        setMaintenanceTargetId(null);
        setMaintenanceAll(false);
        setMaintenanceValue(0);
      } catch (error: any) {
        showNotification(error?.message || 'Error al registrar mantenimiento', 'error');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
        <div className="bg-white rounded-[40px] p-8 w-full max-w-lg shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black">Registrar Mantenimiento</h3>
            <button onClick={() => setMaintenanceMode(false)} className="p-2 rounded-full hover:bg-gray-100"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            {!maintenanceAll && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Equipo</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  value={maintenanceTargetId || ''}
                  onChange={(e) => setMaintenanceTargetId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Selecciona un equipo</option>
                  {equipment.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-1">Costo de mantenimiento</label>
              <input
                type="number"
                value={maintenanceValue}
                min={0}
                onChange={(e) => setMaintenanceValue(parseFloat(e.target.value) || 0)}
                className="w-full p-3 border border-gray-200 rounded-xl"
                placeholder="0.00"
              />
              <p className="text-[10px] text-gray-400 mt-1">Si está en 0, usará el costo registrado del equipo.</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="maintenance-all"
                type="checkbox"
                checked={maintenanceAll}
                onChange={(e) => setMaintenanceAll(e.target.checked)}
              />
              <label htmlFor="maintenance-all" className="text-xs font-black">Aplicar a todos los equipos</label>
            </div>

            <button
              onClick={handleApply}
              className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black hover:bg-indigo-700"
            >
              Aplicar mantenimiento
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRentalModal = () => {
    if (!rentalModal) return null;

    const onClose = () => setRentalModal(null);

    if (rentalModal.type === 'start') {
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black">Iniciar Renta: {rentalModal.rentalType}</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seleccionar Equipo</label>
                <select 
                  id="rent-equip-id"
                  value={selectedEquipmentIdForRental}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setSelectedEquipmentIdForRental(selectedId);
                    const equip = equipment.find(eq => eq.id.toString() === selectedId);
                    if (equip) {
                      (document.getElementById('rent-id') as HTMLInputElement).value = equip.name;
                    }
                  }}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold mb-4"
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {equipment
                    .filter(eq => eq.type === rentalModal.rentalType && (eq.status === 'available' || eq.id === rentalModal.equipmentId))
                    .map(eq => {
                      const isDetected = eq.pc_id ? equipmentOnlineByPcId[eq.pc_id] : true;
                      return (
                        <option key={eq.id} value={eq.id} disabled={!isDetected}>
                          {eq.name} ({eq.status}) {eq.pc_id ? `- ${isDetected ? 'online' : 'offline'}` : ''}
                        </option>
                      );
                    })
                  }
                </select>

                {selectedEquipmentIdForRental && (
                  <div className="mb-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Periféricos Incluidos</p>
                    <div className="flex flex-wrap gap-2">
                      {peripherals.filter(p => p.equipment_id === parseInt(selectedEquipmentIdForRental)).length > 0 ? (
                        peripherals.filter(p => p.equipment_id === parseInt(selectedEquipmentIdForRental)).map(p => (
                          <span key={p.id} className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-indigo-600 border border-indigo-200">
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-indigo-400 italic">No hay periféricos asignados a este equipo.</span>
                      )}
                    </div>
                  </div>
                )}

                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Identificador (ej. PC-01)</label>
                <input 
                  id="rent-id" 
                  type="text" 
                  defaultValue={rentalModal.identifier || ''}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" 
                  placeholder="ID del equipo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setRentalTimeType('unlimited')}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${
                    rentalTimeType === 'unlimited' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                      : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  Tiempo Libre
                </button>
                <button 
                  onClick={() => setRentalTimeType('timed')}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${
                    rentalTimeType === 'timed' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                      : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  Tiempo Medido
                </button>
              </div>

              {rentalTimeType === 'timed' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Minutos de Renta</label>
                  <input 
                    type="number" 
                    value={rentalLimitMinutes}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value);
                      setRentalLimitMinutes(val);
                    }}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" 
                    placeholder="60" 
                  />
                </motion.div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Periféricos Extras (Opcional)</label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-2xl">
                  {peripherals.filter(p => p.status === 'available' && !p.equipment_id).map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors">
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" value={p.id} name="peripheral-select" />
                      <span className="text-sm font-bold text-gray-700">{p.name} ({p.type})</span>
                    </label>
                  ))}
                  {peripherals.filter(p => p.status === 'available').length === 0 && (
                    <p className="text-[10px] text-gray-400 text-center py-2 uppercase font-black">No hay periféricos disponibles</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Anticipo (Opcional)</label>
                <input 
                  id="rent-adv" 
                  type="number" 
                  defaultValue="0"
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" 
                  placeholder="0.00" 
                />
              </div>
              <button 
                onClick={() => {
                  const equipId = (document.getElementById('rent-equip-id') as HTMLSelectElement).value;
                  const id = (document.getElementById('rent-id') as HTMLInputElement).value;
                  const adv = (document.getElementById('rent-adv') as HTMLInputElement).value;
                  const selectedPeripherals = Array.from(document.querySelectorAll('input[name="peripheral-select"]:checked')).map(el => parseInt((el as HTMLInputElement).value));
                  const minutes = rentalTimeType === 'timed' ? Number(rentalLimitMinutes) : 0;

                  if (!id) {
                    showNotification("Por favor ingresa un identificador.", "error");
                    return;
                  }

                  if (minutes <= 0) {
                    showNotification("Debes asignar minutos de renta para iniciar.", "error");
                    return;
                  }

                  const selectedEquipment = equipment.find(eq => eq.id.toString() === equipId);
                  if (selectedEquipment?.pc_id) {
                    const isDetected = equipmentOnlineByPcId[selectedEquipment.pc_id];
                    if (!isDetected) {
                      showNotification("Equipo offline: no se puede iniciar renta hasta que se reconecte.", "error");
                      return;
                    }
                  }

                  startRental(
                    rentalModal.rentalType!, 
                    id, 
                    parseFloat(adv || '0'), 
                    minutes,
                    selectedPeripherals,
                    equipId ? parseInt(equipId) : undefined
                  );
                  onClose();
                }}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Comenzar Renta
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    if (rentalModal.type === 'complete' && rentalModal.rental) {
      const rental = rentalModal.rental;
      
      const parseDate = (d: string) => {
        if (!d) return new Date();
        if (d.includes(' ') && !d.includes('T')) return new Date(d.replace(' ', 'T') + 'Z');
        return new Date(d);
      };

      const start = parseDate(rental.start_time).getTime();
      const now = new Date().getTime();
      
      let diffMinutes = 0;
      if (rental.is_frozen) {
        // If frozen, we use the time that was already spent
        if (rental.limit_minutes > 0) {
          diffMinutes = Math.max(1, rental.limit_minutes - Math.floor((rental.remaining_seconds || 0) / 60));
        } else {
          diffMinutes = Math.max(1, Math.floor((rental.remaining_seconds || 0) / 60));
        }
      } else {
        diffMinutes = Math.max(1, Math.floor((now - start) / 60000));
      }
      
      const rateProduct = products.find(p => p.category.toLowerCase() === rental.type.toLowerCase());
      const hourlyRate = rateProduct ? rateProduct.price : 20;
      
      let timeCost = 0;
      if (rental.limit_minutes > 0) {
        // Timed rental: Charge at least the limit, or more if they went over
        const effectiveMinutes = Math.max(rental.limit_minutes, diffMinutes);
        timeCost = (effectiveMinutes / 60) * hourlyRate;
      } else {
        // Unlimited: Minimum 15 minutes
        const effectiveMinutes = Math.max(15, diffMinutes);
        timeCost = (effectiveMinutes / 60) * hourlyRate;
      }

      const itemsCost = rentalItems.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0);
      
      // Rounding time cost to owner's benefit (always round up to the next peso)
      timeCost = Math.ceil(timeCost);

      let totalSuggested = timeCost + itemsCost;

      const hours = diffMinutes / 60;

      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black">Finalizar Renta: {rental.identifier}</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tiempo Total</p>
                  <p className="text-2xl font-black text-gray-900">{Math.floor(hours)}h {Math.round((hours % 1) * 60)}m</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">
                    {rental.limit_minutes > 0 ? `Plan: ${rental.limit_minutes} min` : 'Tiempo Libre'}
                  </p>
                </div>
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Costo Tiempo</p>
                  <p className="text-2xl font-black text-indigo-600">${timeCost.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-indigo-400 mt-1">
                    Tarifa: ${hourlyRate}/hr
                  </p>
                </div>
              </div>

              {rentalItems.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-3xl p-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Artículos y Consumibles</p>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {rentalItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">Cant: {item.quantity} x ${item.price_at_time.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-black text-gray-900">${(item.quantity * item.price_at_time).toFixed(2)}</p>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRentalItem(item.id, rental.id);
                            }}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Eliminar consumo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subtotal Items</span>
                    <span className="text-sm font-black text-gray-900">${itemsCost.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-indigo-600 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200">
                <div>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total a Cobrar</p>
                  <p className="text-4xl font-black">${(totalSuggested - rental.advance_payment).toFixed(2)}</p>
                  {rental.advance_payment > 0 && (
                    <p className="text-[10px] font-bold text-indigo-200 mt-1">
                      Total Bruto: ${totalSuggested.toFixed(2)}
                    </p>
                  )}
                </div>
                {rental.advance_payment > 0 && (
                  <div className="text-right">
                    <div className="bg-white/20 px-3 py-1 rounded-full inline-block mb-1">
                      <p className="text-[10px] font-black uppercase tracking-widest">Anticipo Pagado</p>
                    </div>
                    <p className="text-2xl font-black">-${rental.advance_payment.toFixed(2)}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monto Final a Cobrar</label>
                <input 
                  id="final-price" 
                  type="number" 
                  defaultValue={totalSuggested.toFixed(2)}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-black text-2xl text-center" 
                />
              </div>

              <button 
                onClick={() => {
                  const final = (document.getElementById('final-price') as HTMLInputElement).value;
                  if (final) {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Confirmar Cobro',
                      message: `¿Estás seguro de cobrar $${parseFloat(final).toFixed(2)} y cerrar esta renta?`,
                      onConfirm: async () => {
                      await runProcess('confirm-rental', async () => {
                        await completeRental(rental, parseFloat(final), rentalItems, timeCost);
                        onClose();
                      });
                    }
                    });
                  }
                }}
                className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-gray-200 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3"
              >
                <CreditCard size={24} />
                Cobrar y Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    if (rentalModal.type === 'add-item' && rentalModal.rental) {
      const currentItemsCost = rentalItems.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0);
      
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-10 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black">Agregar Consumibles</h3>
                <p className="text-gray-400 font-bold text-sm">Cuenta de: <span className="text-indigo-600">{rentalModal.rental.identifier}</span></p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
              {/* Left: Product Selection */}
              <div className="flex flex-col overflow-hidden">
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Buscar producto..." 
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      value={searchQuery}
                    />
                  </div>

                  {/* Category Chips */}
                  <div className="flex gap-2 overflow-x-auto pb-2 pr-2 custom-scrollbar no-scrollbar">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        selectedCategory === 'all' 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      Todos
                    </button>
                    {Array.from(new Set(products.filter(p => !['pc', 'console'].includes(p.category)).map(p => p.category))).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          selectedCategory === cat 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-3 pr-2 custom-scrollbar">
                  {products
                    .filter(p => 
                      !['pc', 'console'].includes(p.category) && 
                      (selectedCategory === 'all' || p.category === selectedCategory) &&
                      p.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(product => (
                    <button
                      key={product.id}
                      onClick={async () => {
                        if (['recharge', 'service', 'giftcard'].includes(product.category)) {
                          setServiceModal({ 
                            isOpen: true, 
                            product, 
                            details: '', 
                            customAmount: '',
                            loading: false,
                            targetRentalId: rentalModal.rental?.id 
                          });
                          setRentalModal(null);
                          return;
                        }
                        
                        const quantity = 1;
                        const response = await fetch(`/api/rentals/${rentalModal.rental!.id}/add-item`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ product_id: product.id, quantity, price: product.price })
                        });
                        
                        if (response.ok) {
                          const itemsRes = await fetch(`/api/rentals/${rentalModal.rental!.id}/items`);
                          const itemsData = await itemsRes.json();
                          setRentalItems(itemsData);
                          fetchData();
                          showNotification(`${product.name} agregado`, 'success');
                        }
                      }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 hover:ring-2 hover:ring-indigo-500 transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                          <Package size={24} />
                        </div>
                        <div>
                          <p className="font-black text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-indigo-600">${(product.price || 0).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 font-bold">Stock: {product.stock}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Current Items in Account */}
              <div className="bg-gray-50 rounded-[32px] p-8 flex flex-col overflow-hidden border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs">Items en la Cuenta</h4>
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black">
                    {rentalItems.length} ITEMS
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {rentalItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 opacity-50">
                      <ShoppingCart size={48} strokeWidth={1} />
                      <p className="font-bold text-sm">No hay consumibles aún</p>
                    </div>
                  ) : (
                    rentalItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">${item.price_at_time.toFixed(2)} c/u</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-gray-100 rounded-xl p-1">
                            <button 
                              onClick={async () => {
                                if (item.quantity <= 1) return;
                                const res = await fetch(`/api/rentals/items/${item.id}`, { 
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ quantity: item.quantity - 1 })
                                });
                                if (res.ok) {
                                  const itemsRes = await fetch(`/api/rentals/${rentalModal.rental!.id}/items`);
                                  const itemsData = await itemsRes.json();
                                  setRentalItems(itemsData);
                                  fetchData();
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                            <button 
                              onClick={async () => {
                                const res = await fetch(`/api/rentals/items/${item.id}`, { 
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ quantity: item.quantity + 1 })
                                });
                                if (res.ok) {
                                  const itemsRes = await fetch(`/api/rentals/${rentalModal.rental!.id}/items`);
                                  const itemsData = await itemsRes.json();
                                  setRentalItems(itemsData);
                                  fetchData();
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button 
                            onClick={async () => {
                              const res = await fetch(`/api/rentals/items/${item.id}`, { method: 'DELETE' });
                              if (res.ok) {
                                const itemsRes = await fetch(`/api/rentals/${rentalModal.rental!.id}/items`);
                                const itemsData = await itemsRes.json();
                                setRentalItems(itemsData);
                                fetchData();
                                showNotification('Item quitado', 'success');
                              }
                            }}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Total Consumibles</span>
                    <span className="text-2xl font-black text-indigo-600">${currentItemsCost.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={onClose}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-lg"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    if (rentalModal.type === 'adjust-time' && rentalModal.rental) {
      const isAdd = rentalModal.adjustmentType === 'add';
      const presets = [15, 30, 60, 120];
      
      return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black">
                {isAdd ? 'Agregar Tiempo' : 'Reducir Tiempo'}: {rentalModal.rental.identifier}
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Minutos</label>
                <input 
                  type="number" 
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(parseInt(e.target.value) || 0)}
                  className="w-full p-6 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-black text-3xl text-center"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {presets.map(p => (
                  <button
                    key={p}
                    onClick={() => setAdjustmentValue(p)}
                    className={`py-3 rounded-xl font-black text-xs transition-all ${
                      adjustmentValue === p 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {p}m
                  </button>
                ))}
              </div>

              <button 
                onClick={() => {
                  if (isAdd) {
                    addTimeToRental(rentalModal.rental!.id, adjustmentValue);
                  } else {
                    reduceTimeToRental(rentalModal.rental!.id, adjustmentValue);
                  }
                  onClose();
                }}
                className={`w-full py-5 rounded-3xl font-black text-xl shadow-xl transition-all ${
                  isAdd 
                    ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' 
                    : 'bg-orange-600 text-white shadow-orange-100 hover:bg-orange-700'
                }`}
              >
                {isAdd ? 'Confirmar Adición' : 'Confirmar Reducción'}
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return null;
  };

  const renderTicket = () => {
    if (!showTicket) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] max-w-sm w-full font-mono text-sm shadow-2xl relative border-t-8 border-indigo-600 print:shadow-none print:border-none print:max-w-none print:w-full"
        >
          <button 
            onClick={() => setShowTicket(null)} 
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors print:hidden"
          >
            <X size={20} />
          </button>
          
          <div className="text-center border-b-2 border-dashed border-gray-100 pb-6 mb-6">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} />
            </div>
            <h2 className="text-2xl font-black text-gray-900">GC WEB</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gaming & Connectivity</p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase">Comprobante</span>
              <span className="font-bold text-gray-900">#{showTicket.data.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase">Fecha</span>
              <span className="font-bold text-gray-900">{showTicket.data.date || new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="border-b-2 border-dashed border-gray-100 pb-6 mb-6 space-y-4">
            {showTicket.type === 'Venta Directa' ? (
              showTicket.data.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{item.product.name}</p>
                    <p className="text-[10px] text-gray-400">{item.quantity} x ${item.product.price.toFixed(2)}</p>
                  </div>
                  <span className="font-bold text-gray-900">${(item.quantity * item.product.price).toFixed(2)}</span>
                </div>
              ))
            ) : showTicket.type === 'Inicio de Renta' ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Equipo:</span>
                  <span className="font-bold">{showTicket.data.identifier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo:</span>
                  <span className="font-bold">{showTicket.data.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiempo:</span>
                  <span className="font-bold">{showTicket.data.limitMinutes > 0 ? `${showTicket.data.limitMinutes} min` : 'Libre'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Equipo</p>
                    <p className="font-bold">{showTicket.data.identifier}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Duración</p>
                    <p className="font-bold">{showTicket.data.type}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-900">Tiempo de Uso:</span>
                    <span className="font-bold text-gray-900">${(showTicket.data.timeCost || 0).toFixed(2)}</span>
                  </div>
                  
                  {showTicket.data.items && showTicket.data.items.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumos Extra</p>
                      {showTicket.data.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-600">{item.quantity}x {item.name}</span>
                          <span className="font-bold text-gray-900">${(item.quantity * (item.price_at_time || 0)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {showTicket.type !== 'Inicio de Renta' && (
              <div className="flex justify-between items-center text-lg">
                <span className="font-black text-gray-900">TOTAL</span>
                <span className="font-black text-indigo-600">${(showTicket.data.total || 0).toFixed(2)}</span>
              </div>
            )}
            
            {showTicket.type === 'Inicio de Renta' && (
              <div className="flex justify-between items-center text-lg">
                <span className="font-black text-gray-900">ANTICIPO</span>
                <span className="font-black text-indigo-600">${(showTicket.data.advance || 0).toFixed(2)}</span>
              </div>
            )}
            
            {showTicket.type === 'Ticket de Renta' && showTicket.data.advance > 0 && (
              <div className="pt-2 border-t border-gray-50 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Anticipo Pagado:</span>
                  <span>-${(showTicket.data.advance || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-gray-900">
                  <span>PENDIENTE:</span>
                  <span>${(showTicket.data.due || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-center mt-10 space-y-1">
            <p className="text-xs font-black text-gray-900 uppercase">¡Gracias por tu visita!</p>
            <p className="text-[10px] text-gray-400">Síguenos en redes sociales @gcweb_gaming</p>
          </div>

          <div className="mt-8 flex gap-3 print:hidden">
            <button 
              onClick={() => window.print()}
              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button 
              onClick={() => setShowTicket(null)}
              className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 text-red-500">
            <AlertCircle size={40} />
          </div>
          <h3 className="text-2xl font-black text-center mb-4">{confirmModal.title}</h3>
          <p className="text-gray-500 text-center mb-10 font-medium leading-relaxed">{confirmModal.message}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={async () => {
                if (confirmModal.loading) return;
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                  await confirmModal.onConfirm();
                } catch (err) {
                  console.error('Confirm action error', err);
                  showWarning('Error en la operación', 'Ocurrió un error al ejecutar la acción.');
                } finally {
                  setConfirmModal({ ...confirmModal, isOpen: false, loading: false });
                }
              }}
              disabled={confirmModal.loading}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-red-500 text-white shadow-lg shadow-red-100 hover:bg-red-600 transition-all disabled:opacity-60"
            >
              {confirmModal.loading ? 'Procesando...' : 'Confirmar'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

const renderWarningModal = () => {
    if (!warningModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-yellow-50 rounded-[40px] p-8 max-w-md w-full shadow-2xl border-2 border-yellow-200"
        >
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-black text-center mb-3 text-yellow-800">{warningModal.title}</h3>
          <p className="text-sm text-yellow-700 text-center mb-6">{warningModal.message}</p>
          <div className="text-center">
            <button
              onClick={() => setWarningModal({ ...warningModal, isOpen: false })}
              className="px-6 py-2 rounded-xl bg-yellow-600 text-white font-black uppercase tracking-widest hover:bg-yellow-700 transition-all"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderEditItemModal = () => {
    if (!editingItem) return null;
    const { type, data } = editingItem;
    
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black">Editar {type === 'product' ? 'Producto' : type === 'equipment' ? 'Equipo' : 'Periférico'}</h3>
            <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
              <input 
                id="edit-name"
                defaultValue={data.name}
                className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Costo / Inversión</label>
                <input 
                  id="edit-cost"
                  type="number"
                  defaultValue={data.cost}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                />
              </div>
              {type === 'product' && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Precio Venta</label>
                  <input 
                    id="edit-price"
                    type="number"
                    defaultValue={data.price}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  />
                </div>
              )}
            </div>

            {type === 'product' && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Stock</label>
                <input 
                  id="edit-stock"
                  type="number"
                  defaultValue={data.stock}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                />
              </div>
            )}

            {(type === 'equipment' || type === 'peripheral') && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Estado</label>
                  <select 
                    id="edit-status"
                    defaultValue={data.status}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  >
                    <option value="available">Disponible</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="out_of_service">Fuera de Servicio</option>
                  </select>
                </div>
                {type === 'equipment' && (
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">PC ID / Badge</label>
                    <input
                      id="edit-pc-id"
                      defaultValue={data.pc_id || ''}
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    />
                  </div>
                )}
              </>
            )}

            <button 
              onClick={() => {
                const updatedData: any = {
                  name: (document.getElementById('edit-name') as HTMLInputElement).value,
                  cost: parseFloat((document.getElementById('edit-cost') as HTMLInputElement).value || '0'),
                };
                
                if (type === 'product') {
                  updatedData.price = parseFloat((document.getElementById('edit-price') as HTMLInputElement).value || '0');
                  updatedData.stock = parseInt((document.getElementById('edit-stock') as HTMLInputElement).value || '0');
                  updatedData.category = data.category;
                }
                
                if (type === 'equipment' || type === 'peripheral') {
                  updatedData.status = (document.getElementById('edit-status') as HTMLSelectElement).value;
                  updatedData.type = data.type || (type === 'equipment' ? (data.category === 'pc' ? 'PC' : 'Console') : data.type);
                  if (type === 'equipment') {
                    updatedData.pc_id = (document.getElementById('edit-pc-id') as HTMLInputElement).value.trim();
                  }
                  if (type === 'peripheral') {
                    updatedData.equipment_id = data.equipment_id;
                  }
                }
                
                handleEditSave(type, data.id, updatedData);
              }}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Guardar Cambios
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderNotification = () => {
    return (
      <AnimatePresence>
        {isCashOutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCashOutModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <ReceiptText size={40} />
                </div>
                <h3 className="text-3xl font-black mb-2">Corte de Caja</h3>
                <p className="text-gray-400 font-medium mb-8">Resumen financiero del día de hoy.</p>
                
                <div className="space-y-4 mb-10">
                  {(() => {
                    const today = new Date().toLocaleDateString('en-CA');
                    const todaySales = summary?.todayRevenue || 0;
                    const todayExpenses = expenses.filter(e => new Date(e.timestamp).toLocaleDateString('en-CA') === today).reduce((s, e) => s + e.amount, 0);
                    const netProfit = todaySales - todayExpenses;

                    return (
                      <>
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                          <span className="text-gray-500 font-bold">Ventas Totales</span>
                          <span className="text-xl font-black text-emerald-600">${todaySales.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                          <span className="text-gray-500 font-bold">Gastos Registrados</span>
                          <span className="text-xl font-black text-red-500">-${todayExpenses.toFixed(2)}</span>
                        </div>
                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-gray-900 font-black uppercase text-xs tracking-widest">Utilidad del Día</span>
                          <span className={`text-3xl font-black ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                            ${netProfit.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsCashOutModalOpen(false)}
                    className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cerrar
                  </button>
                  <button 
                    onClick={() => {
                      window.print();
                      setIsCashOutModalOpen(false);
                    }}
                    className="py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Printer size={18} />
                    Imprimir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isReportModalOpen && reportData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-10 overflow-y-auto flex-1">
                <div className="flex justify-between items-start mb-10">
                  <div className="text-left">
                    <h3 className="text-3xl font-black text-gray-900">Reporte Financiero</h3>
                    <p className="text-gray-400 font-medium">Periodo: {reportData.start} al {reportData.end}</p>
                  </div>
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <FileText size={32} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-10">
                  <div className="bg-emerald-50 p-6 rounded-3xl">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Ingresos</p>
                    <p className="text-2xl font-black text-emerald-700">${reportData.revenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-3xl">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Gastos</p>
                    <p className="text-2xl font-black text-red-700">-${reportData.expenses.toFixed(2)}</p>
                  </div>
                  <div className="bg-indigo-50 p-6 rounded-3xl">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Utilidad</p>
                    <p className={`text-2xl font-black ${reportData.profit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                      ${reportData.profit.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Desglose de Gastos</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {reportData.categories.map((cat: any) => (
                      <div key={cat.category} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                        <span className="text-gray-500 font-bold capitalize">{cat.category}</span>
                        <span className="font-black text-gray-900">${cat.total.toFixed(2)}</span>
                      </div>
                    ))}
                    {reportData.categories.length === 0 && (
                      <p className="col-span-2 text-center text-gray-400 py-4 italic">No hay gastos en este periodo.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                <button 
                  onClick={() => setIsReportModalOpen(false)}
                  className="flex-1 py-4 bg-white text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-200"
                >
                  Cerrar
                </button>
                <button 
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  Imprimir Reporte
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {notification && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[220]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black ${
              notification.type === 'success' ? 'bg-emerald-500 text-white' : 
              notification.type === 'error' ? 'bg-red-500 text-white' : 
              'bg-indigo-600 text-white'
            }`}>
              {notification.type === 'success' ? <CheckCircle size={20} /> : 
               notification.type === 'error' ? <AlertCircle size={20} /> : 
               <Info size={20} />}
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderTimeOverAlert = () => {
    if (!timeOverAlert) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center border-t-8 border-red-500"
        >
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <AlertCircle size={48} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">¡Tiempo Agotado!</h2>
          <p className="text-gray-500 mb-8">
            La sesión en <span className="font-black text-gray-900">{timeOverAlert.identifier}</span> ha finalizado.
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={() => {
                setAdjustmentValue(15);
                setRentalModal({ type: 'adjust-time', rental: timeOverAlert, adjustmentType: 'add' });
                setTimeOverAlert(null);
              }}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Agregar más tiempo
            </button>
            
            <button 
              onClick={() => {
                openCompleteModal(timeOverAlert);
                setTimeOverAlert(null);
              }}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <ReceiptText size={20} />
              Ir a cobrar
            </button>
            
            <button 
              onClick={() => setTimeOverAlert(null)}
              className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-black text-lg hover:bg-gray-200 transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderPaymentModal = () => {
    if (!paymentModal.isOpen) return null;

    const received = parseFloat(amountReceived) || 0;
    const change = received - paymentModal.amount;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border-4 border-indigo-600"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-gray-900">Confirmar Pago</h3>
            <button 
              onClick={() => setPaymentModal({ ...paymentModal, isOpen: false })} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-8">
            <div className="bg-indigo-50 p-8 rounded-3xl text-center border-2 border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">{paymentModal.title}</p>
              <p className="text-5xl font-black text-indigo-600">${paymentModal.amount.toFixed(2)}</p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Efectivo Recibido</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">$</span>
                <input 
                  type="number" 
                  autoFocus
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full p-6 pl-12 bg-gray-50 border-none rounded-3xl focus:ring-4 focus:ring-indigo-500/20 transition-all font-black text-3xl text-gray-900" 
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className={`p-8 rounded-3xl transition-all border-2 ${change >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cambio a Entregar</p>
              <p className={`text-4xl font-black ${change >= 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                ${Math.max(0, change).toFixed(2)}
              </p>
            </div>

            <button 
              disabled={received < paymentModal.amount}
              onClick={() => {
                paymentModal.onConfirm();
                setPaymentModal({ ...paymentModal, isOpen: false });
                setAmountReceived('');
              }}
              className={`w-full py-6 rounded-3xl font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 ${
                received >= paymentModal.amount 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check size={28} />
              Finalizar Venta
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <>
      {renderPaymentModal()}
      <AnimatePresence mode="wait">
        {!isLoaded && (
          isSplashTimeout ? (
            <div className="fixed inset-0 z-[140] bg-white flex items-center justify-center"> 
              <div className="text-center">
                <p className="text-xl font-black text-gray-700">Cargando (fallback)…</p>
                <p className="text-gray-400 text-sm">Si esto persiste, el Splash específico está fallando.</p>
              </div>
            </div>
          ) : (
            <SplashScreen
              key="splash"
              onComplete={() => {
                setIsLoaded(true);
                setIsSplashTimeout(false);
                setIsSplashError(false);
                console.log('SplashScreen onComplete fired');
              }}
            />
          )
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-black tracking-tighter text-indigo-600">GC WEB</h1>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">Cibercafé Manager</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<ShoppingCart size={20} />} 
            label="Punto de Venta" 
            active={activeTab === 'pos'} 
            onClick={() => setActiveTab('pos')} 
          />
          <SidebarItem 
            icon={<Monitor size={20} />} 
            label="Rentas PC/Consola" 
            active={activeTab === 'rentals'} 
            onClick={() => setActiveTab('rentals')} 
          />
          <SidebarItem 
            icon={<Package size={20} />} 
            label="Inventario" 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')} 
          />
          <SidebarItem 
            icon={<Calculator size={20} />} 
            label="Contabilidad" 
            active={activeTab === 'accounting'} 
            onClick={() => setActiveTab('accounting')} 
          />
          <SidebarItem 
            icon={<ShoppingCart size={20} />} 
            label="Ventas" 
            active={activeTab === 'sales'} 
            onClick={() => setActiveTab('sales')} 
          />
          <SidebarItem 
            icon={<Trash2 size={20} />} 
            label="Bajas y Mermas" 
            active={activeTab === 'losses'} 
            onClick={() => setActiveTab('losses')} 
          />
          <SidebarItem 
            icon={<TrendingUp size={20} />} 
            label="Análisis" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Ganancia Hoy</p>
            <p className="text-2xl font-black text-indigo-900">${summary?.todayProfit?.toFixed(2) || '0.00'}</p>
            <div className="mt-2 h-1 bg-indigo-200 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                className="h-full bg-indigo-600"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-10">
          <h2 className="text-xl font-black text-gray-900">
            {activeTab === 'pos' && 'Punto de Venta'}
            {activeTab === 'rentals' && 'Gestión de Rentas'}
            {activeTab === 'inventory' && 'Control de Inventario'}
            {activeTab === 'accounting' && 'Contabilidad y Gastos'}
            {activeTab === 'sales' && 'Ventas Taecel'}
            {activeTab === 'losses' && 'Bajas y Mermas'}
            {activeTab === 'analytics' && 'Rendimiento del Negocio'}
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar productos o servicios..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3 bg-gray-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 w-80 transition-all"
              />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200">
              GC
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'pos' && (
              <motion.div 
                key="pos"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-12 gap-10 h-full"
              >
                {/* Products Grid */}
                <div className="col-span-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                      <Package className="text-emerald-500" size={28} />
                      Consumibles
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsTaecelCatalogModalOpen(true);
                          fetchTaecelCatalog();
                        }}
                        className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all"
                      >
                        <Package size={18} />
                        Ver Catálogo Taecel
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.length === 0 ? (
                      <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-400">
                        <Package size={64} strokeWidth={1} className="mb-6 opacity-20" />
                        <p className="font-black text-xl text-gray-600">No se encontraron resultados</p>
                        <p className="text-sm mt-2">Intenta con otra búsqueda o categoría.</p>
                      </div>
                    ) : (
                      filteredProducts.map(product => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          onAdd={() => {
                            if (product.category !== 'product') {
                              setServiceModal({
                                isOpen: true,
                                product: product,
                                details: '',
                                customAmount: '',
                                loading: false,
                                targetRentalId: null
                              });
                            } else {
                              addToCart(product);
                            }
                          }} 
                        />
                      ))
                    )}
                    <button 
                      onClick={async () => {
                        const name = prompt("Nombre del nuevo producto:");
                        const price = prompt("Precio de venta:");
                        const cost = prompt("Costo de inversión:");
                        const cat = prompt("Categoría (product, pc, console, controller, mouse, keyboard, headset):", "product");
                        if (name && price && cost) {
                          await fetch('/api/products', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, category: cat, price: parseFloat(price), cost: parseFloat(cost), stock: 100 })
                          });
                          fetchData();
                        }
                      }}
                      className="border-2 border-dashed border-gray-200 rounded-[32px] flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all min-h-[240px] group"
                    >
                      <div className="p-4 bg-gray-50 rounded-2xl group-hover:bg-indigo-100 transition-colors">
                        <Plus size={32} />
                      </div>
                      <span className="font-black text-sm uppercase tracking-widest">Nuevo Item</span>
                    </button>
                  </div>
                </div>

                {/* Cart */}
                <div className="col-span-4 bg-white rounded-[40px] shadow-2xl shadow-gray-200/50 border border-gray-100 flex flex-col overflow-hidden sticky top-0 h-[calc(100vh-180px)]">
                  <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                      <ShoppingCart size={28} className="text-indigo-600" />
                      Orden
                    </h3>
                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black">
                      {cart.length} Items
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <ShoppingCart size={48} strokeWidth={1} />
                        <p className="font-medium">El carrito está vacío</p>
                      </div>
                    ) : (
                      cart.map(item => (
                        <div key={item.product.id} className="flex items-center justify-between group">
                          <div>
                            <p className="font-bold text-gray-800">{item.product.name}</p>
                            <p className="text-xs text-gray-500">{item.quantity} x ${item.product.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-indigo-600">${(item.quantity * item.product.price).toFixed(2)}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.product.id);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              title="Quitar del carrito"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-6 bg-gray-50 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Subtotal</span>
                      <span className="font-bold">${cart.reduce((s, i) => s + i.product.price * i.quantity, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl">
                      <span className="font-black">Total</span>
                      <span className="font-black text-indigo-600">${cart.reduce((s, i) => s + i.product.price * i.quantity, 0).toFixed(2)}</span>
                    </div>
                    <button 
                      disabled={cart.length === 0}
                      onClick={handleSale}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard size={20} />
                      Cobrar Ahora
                    </button>

                    {cart.length > 0 && activeRentals.length > 0 && (
                      <div className="pt-4 border-t border-gray-200 space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">O asignar a renta activa:</p>
                        <div className="grid grid-cols-1 gap-2">
                          {activeRentals.map(rental => (
                            <button
                              key={rental.id}
                              onClick={async () => {
                                try {
                                  for (const item of cart) {
                                    await fetch(`/api/rentals/${rental.id}/add-item`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ 
                                        product_id: item.product.id, 
                                        quantity: item.quantity, 
                                        price: item.product.price 
                                      })
                                    });
                                  }
                                  setCart([]);
                                  fetchData();
                                  showNotification(`Items asignados a ${rental.identifier}`, 'success');
                                } catch (e) {
                                  showNotification('Error al asignar items', 'error');
                                }
                              }}
                              className="w-full bg-white border-2 border-indigo-100 text-indigo-600 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                            >
                              <Monitor size={16} />
                              {rental.identifier} ({rental.type})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'rentals' && (
              <motion.div 
                key="rentals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-4 gap-6">
                  <RentalActionCard 
                    icon={<Monitor size={32} />} 
                    title="Nueva PC" 
                    color="bg-blue-500"
                    onClick={() => setRentalModal({ type: 'start', rentalType: 'PC' })}
                  />
                  <RentalActionCard 
                    icon={<Gamepad2 size={32} />} 
                    title="Nueva Consola" 
                    color="bg-purple-500"
                    onClick={() => setRentalModal({ type: 'start', rentalType: 'Console' })}
                  />
                  <button
                    onClick={() => {
                      setMaintenanceMode(true);
                      setMaintenanceAll(false);
                      setMaintenanceTargetId(null);
                      setMaintenanceValue(0);
                    }}
                    className="bg-yellow-500 text-white rounded-2xl font-black p-4 hover:bg-yellow-600 transition-all"
                  >
                    Mantenimiento a Equipo
                  </button>
                  <button
                    onClick={() => {
                      setMaintenanceMode(true);
                      setMaintenanceAll(true);
                      setMaintenanceTargetId(null);
                      setMaintenanceValue(0);
                    }}
                    className="bg-amber-500 text-white rounded-2xl font-black p-4 hover:bg-amber-600 transition-all"
                  >
                    Mantenimiento a Todos
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 mt-3">
                  <h4 className="text-lg font-black">Vista en Tiempo Real</h4>
                  <button
                    onClick={() => setShowPcLiveView(prev => !prev)}
                    className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${showPcLiveView ? 'bg-red-500 text-white border-red-500' : 'bg-green-500 text-white border-green-500'}`}
                  >
                    {showPcLiveView ? 'Ocultar vista' : 'Mostrar vista'}
                  </button>
                </div>

                {showPcLiveView && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeRentals.length === 0 ? (
                        <div className="col-span-full text-center text-gray-400 py-8">
                          No hay rentas activas para vista en vivo.
                        </div>
                      ) : (
                        activeRentals.map(rental => (
                          <div key={`live-${rental.id}`} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-black">{rental.identifier}</span>
                              <span className="text-[10px] uppercase text-gray-500 font-bold">{rental.type}</span>
                            </div>
                            <img
                              src={DEFAULT_PC_BLOCKED_IMAGE_URL}
                              alt="Pantalla PC"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <div className="text-xs text-gray-600">
                              Status: {rental.is_overdue ? 'Tiempo agotado / Bloqueada' : 'Activa'}
                            </div>
                            <div className="text-xs text-gray-600">Tiempo restante: {rental.remaining_seconds != null ? `${Math.max(0, rental.remaining_seconds)}s` : 'N/A'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Estaciones de Juego Registradas */}
                <div className="space-y-6">
                  {/* PCs Section */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-blue-50/30">
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <Monitor size={20} className="text-blue-500" />
                        Computadoras (PCs)
                      </h3>
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                        {equipment.filter(e => e.type === 'PC').length} Equipos
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {equipment.filter(e => e.type === 'PC' && (!e.pc_id || discoveredPCs.some(d => d.pc_id === e.pc_id && d.status === 'paired'))).map(station => {
                          const activeRental = activeRentals.find(r => r.equipment_id === station.id || r.identifier === station.name);
                          return (
                            <EquipmentStationCard 
                              key={station.id}
                              station={station}
                              peripherals={peripherals.filter(p => p.equipment_id === station.id)}
                              activeRental={activeRental}
                              onStart={() => setRentalModal({ 
                                type: 'start', 
                                rentalType: 'PC',
                                identifier: station.name,
                                equipmentId: station.id
                              })}
                              onView={() => {
                                if (activeRental) {
                                  const element = document.getElementById(`rental-${activeRental.id}`);
                                  element?.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              onUnblock={() => unblockEquipment(station.id)}
                            />
                          );
                        })}
                        {equipment.filter(e => e.type === 'PC').length === 0 && (
                          <div className="col-span-full py-8 text-center text-gray-400 italic text-sm">
                            No has registrado PCs en el Inventario aún.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Consoles Section */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-purple-50/30">
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <Gamepad2 size={20} className="text-purple-500" />
                        Consolas de Videojuegos
                      </h3>
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                        {equipment.filter(e => e.type === 'Console').length} Equipos
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {equipment.filter(e => e.type === 'Console').map(station => {
                          const activeRental = activeRentals.find(r => r.equipment_id === station.id || r.identifier === station.name);
                          return (
                            <EquipmentStationCard 
                              key={station.id}
                              station={station}
                              peripherals={peripherals.filter(p => p.equipment_id === station.id)}
                              activeRental={activeRental}
                              onStart={() => setRentalModal({ 
                                type: 'start', 
                                rentalType: 'Console',
                                identifier: station.name,
                                equipmentId: station.id
                              })}
                              onView={() => {
                                if (activeRental) {
                                  const element = document.getElementById(`rental-${activeRental.id}`);
                                  element?.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              onUnblock={() => unblockEquipment(station.id)}
                            />
                          );
                        })}
                        {equipment.filter(e => e.type === 'Console').length === 0 && (
                          <div className="col-span-full py-8 text-center text-gray-400 italic text-sm">
                            No has registrado Consolas en el Inventario aún.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PCs pendientes de inventario */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                    <div className="p-6 border-b border-gray-50 bg-orange-50">
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <span className="text-orange-500">✔</span>
                        PCs pendientes de inventario
                      </h3>
                    </div>
                    <div className="p-6">
                      {pendingPairCodes.length === 0 ? (
                        <div className="text-sm text-gray-400">No hay PCs pendientes (o todos ya están agregados en inventario).</div>
                      ) : (
                        <div className="grid gap-3">
                          {pendingPairCodes.map((item) => (
                            <div key={item.pc_id} className="p-4 border border-gray-200 rounded-xl flex justify-between items-center">
                              <div>
                                <div className="font-black text-gray-900">{item.pc_id}</div>
                                <div className="text-[10px] text-gray-400">Expira: {new Date(item.expires_at).toLocaleString()}</div>
                              </div>
                              <button
                                onClick={() => claimPairCode(item.pc_id)}
                                className="px-4 py-2 bg-green-600 text-white font-black rounded-lg hover:bg-green-700 transition-all"
                              >
                                Agregar a inventario
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PCs detectadas por el servidor */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                    <div className="p-6 border-b border-gray-50 bg-blue-50">
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <span className="text-blue-500">📡</span>
                        PCs detectadas por el servidor
                      </h3>
                    </div>
                    <div className="p-6">
                      {discoveredPCs.length === 0 ? (
                        <div className="text-sm text-gray-400">No se han detectado PCs no asignadas aún.</div>
                      ) : (
                        <div className="grid gap-3">
                          {discoveredPCs.map((item) => (
                            <div key={item.pc_id} className="p-4 border border-gray-200 rounded-xl flex justify-between items-center">
                              <div>
                                <div className="font-black text-gray-900">{item.pc_id}</div>
                                <div className="text-[11px] text-gray-500">ID: {item.pc_id}</div>
                                <div className="text-[10px] text-gray-400">Reporte: {new Date(item.last_seen).toLocaleString()}</div>
                              </div>
                              <button
                                onClick={() => claimPairCode(item.pc_id)}
                                disabled={item.assigned}
                                className={`px-4 py-2 font-black rounded-lg transition-all ${item.assigned ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                              >
                                {item.assigned ? 'Ya asignada' : 'Seleccionar y control'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="text-xl font-black">Rentas Activas</h3>
                    <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {activeRentals.length} En curso
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-6">
                      {activeRentals.length === 0 ? (
                        <div className="col-span-3 py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                          <Monitor size={48} strokeWidth={1} />
                          <p className="font-bold">No hay rentas activas en este momento.</p>
                        </div>
                      ) : (
                        activeRentals.map(rental => (
                          <div id={`rental-${rental.id}`} key={rental.id}>
                            <ActiveRentalCard 
                              rental={rental} 
                              addItemToRental={() => {
                                setSearchQuery(''); // Clear search when opening modal
                                setSelectedCategory('all'); // Reset category when opening modal
                                fetch(`/api/rentals/${rental.id}/items`)
                                  .then(res => res.json())
                                  .then(data => {
                                    setRentalItems(data);
                                    setRentalModal({ type: 'add-item', rental });
                                  });
                              }}
                              onComplete={() => openCompleteModal(rental)}
                              onRemoveLimit={() => updateRentalLimit(rental.id, 0)}
                              onFreeze={() => freezeRental(rental)}
                              onAddTime={() => {
                                setAdjustmentValue(15);
                                setRentalModal({ type: 'adjust-time', rental, adjustmentType: 'add' });
                              }}
                              onReduceTime={() => {
                                setAdjustmentValue(15);
                                setRentalModal({ type: 'adjust-time', rental, adjustmentType: 'reduce' });
                              }}
                              onCancel={() => cancelOrFinishRental(rental)}
                              onUnblock={() => unblockEquipment(rental.equipment_id)}
                              onSendCommand={sendPcCommand}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-12 gap-8">
                  {/* Add Product Form */}
                  <div className="col-span-4">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 sticky top-10">
                      <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <Plus className="text-indigo-600" />
                        Nuevo Item
                      </h3>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre del Item</label>
                          <input id="prod-name" type="text" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="Ej. Mouse Logitech G502" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoría</label>
                          <select 
                            id="prod-cat" 
                            value={formCategory}
                            onChange={(e) => {
                              setFormCategory(e.target.value);
                              if (e.target.value === 'pc' || e.target.value === 'console') {
                                setFormPeripherals([
                                  { type: 'Control', name: '', cost: 0, quantity: 1 },
                                  { type: 'Mouse', name: '', cost: 0, quantity: 1 },
                                  { type: 'Teclado', name: '', cost: 0, quantity: 1 },
                                  { type: 'Audífonos', name: '', cost: 0, quantity: 1 }
                                ]);
                              } else {
                                setFormPeripherals([]);
                              }
                            }}
                            className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                          >
                            <option value="product">Consumible (Snacks/Bebidas)</option>
                            <option value="pc">Equipo de Renta - PC</option>
                            <option value="console">Equipo de Renta - Consola</option>
                          </select>
                        </div>

                        {(formCategory === 'pc' || formCategory === 'console') && (
                          <div className="space-y-4 p-4 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                              <Plus size={14} /> Periféricos Incluidos
                            </h4>
                            {formPeripherals.map((peri, index) => (
                              <div key={index} className="space-y-2 pb-3 border-b border-indigo-100 last:border-0">
                                <p className="text-[10px] font-black text-indigo-400 uppercase">{peri.type}</p>
                                <div className="grid grid-cols-12 gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="Modelo/Nombre"
                                    className="col-span-6 p-2 bg-white border-none rounded-xl text-xs font-bold"
                                    value={peri.name}
                                    onChange={(e) => {
                                      const newPeris = [...formPeripherals];
                                      newPeris[index].name = e.target.value;
                                      setFormPeripherals(newPeris);
                                    }}
                                  />
                                  <input 
                                    type="number" 
                                    placeholder="Costo"
                                    className="col-span-3 p-2 bg-white border-none rounded-xl text-xs font-bold"
                                    value={peri.cost || ''}
                                    onChange={(e) => {
                                      const newPeris = [...formPeripherals];
                                      newPeris[index].cost = parseFloat(e.target.value || '0');
                                      setFormPeripherals(newPeris);
                                    }}
                                  />
                                  <input 
                                    type="number" 
                                    placeholder="Cant"
                                    className="col-span-3 p-2 bg-white border-none rounded-xl text-xs font-bold"
                                    value={peri.quantity || ''}
                                    onChange={(e) => {
                                      const newPeris = [...formPeripherals];
                                      newPeris[index].quantity = parseInt(e.target.value || '1');
                                      setFormPeripherals(newPeris);
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                              {formCategory === 'pc' || formCategory === 'console' ? 'Costo Equipo (Inversión real)' : 'Costo Inversión'}
                            </label>
                            <input id="prod-cost" type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="0.00" />
                            {formCategory === 'pc' || formCategory === 'console' ? (
                              <p className="text-[10px] text-gray-400 mt-1">Costo de compra de la PC/Consola para calcular deuda de baja.</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                              {formCategory === 'pc' || formCategory === 'console' ? 'Precio por Hora (Equipo base)' : 'Precio Venta'}
                            </label>
                            <input id="prod-price" type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="0.00" />
                            {formCategory === 'pc' || formCategory === 'console' ? (
                              <p className="text-[10px] text-gray-400 mt-1">Valor de hora de renta separado del costo de la inversión.</p>
                            ) : null}
                          </div>
                        </div>
                        {(formCategory === 'pc' || formCategory === 'console') && (
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seleccionar PC desde agentes detectados</label>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  setIsSelectPcModalOpen(true);
                                  try {
                                    await fetchData();
                                  } catch (error: any) {
                                    console.error('Error al refrescar lista de PCs:', error);
                                    showNotification('No se pudo refrescar la lista de PCs detectadas, intenta de nuevo.', 'error');
                                  }
                                }}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                              >
                                Abrir lista de PCs instaladas (refrescar)
                              </button>
                              {selectedPcIdForForm ? (
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                  <p className="text-xs font-black">Seleccionado:</p>
                                  <p className="text-sm">{selectedPcNameForForm || selectedPcIdForForm}</p>
                                  <p className="text-[11px] text-gray-500">ID: {selectedPcIdForForm}</p>
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-400">No se ha seleccionado ninguna PC aún.</p>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">El sistema impide seleccionar PCs ya asignadas en inventario.</p>
                          </div>
                        )}
                        {isSelectPcModalOpen && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
                            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">
                              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                                <h3 className="text-lg font-black">Seleccionar PC para inventario</h3>
                                <button onClick={() => setIsSelectPcModalOpen(false)} className="text-gray-500 hover:text-gray-900">Cerrar</button>
                              </div>
                              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-xs text-gray-500">
                                    {`Mostrando ${visiblePcList.length} de ${discoveredPCs.length} PCs detectadas`}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPcListMode('unassigned')}
                                      className={`px-3 py-1 text-xs rounded-full ${pcListMode === 'unassigned' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                      No registradas
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPcListMode('all')}
                                      className={`px-3 py-1 text-xs rounded-full ${pcListMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                      Todas
                                    </button>
                                  </div>
                                </div>
                                {isPcLiveActive && pcLiveId ? (
                                  <div className="rounded-xl border border-indigo-200 p-3 bg-indigo-50 mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <p className="text-xs font-bold">Vista en vivo: {pcLiveId}</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsPcLiveActive(false);
                                          setPcLiveId('');
                                          setPcLiveFrame('');
                                          setPcLiveError('');
                                        }}
                                        className="px-2 py-1 text-[10px] rounded bg-gray-200 hover:bg-gray-300"
                                      >
                                        Detener
                                      </button>
                                    </div>
                                    {pcLiveError ? (
                                      <p className="text-xs text-red-600">{pcLiveError}</p>
                                    ) : pcLiveFrame ? (
                                      <img src={pcLiveFrame} alt="Vista en vivo" className="w-full h-48 object-contain rounded" />
                                    ) : (
                                      <p className="text-xs text-gray-500">Cargando stream...</p>
                                    )}
                                  </div>
                                ) : null}
                                {visiblePcList.length === 0 ? (
                                  <div className="text-sm text-gray-400">
                                    {pcListMode === 'unassigned'
                                      ? 'No se han detectado PCs no asignadas. Cambia a "Todas" para ver la lista completa.'
                                      : 'No se han detectado PCs. Asegúrate de que los agentes estén conectados y en línea.'}
                                  </div>
                                ) : (
                                  visiblePcList.map((item) => {
                                    const assigned = item.assigned || false;
                                    const editedName = pcNameEdits[item.pc_id] || item.pc_id;
                                    return (
                                      <div key={item.pc_id} className="p-3 border border-gray-200 rounded-xl bg-gray-50">
                                        <div className="flex justify-between items-center gap-2">
                                          <div>
                                            <p className="font-black text-sm">{item.pc_id}</p>
                                            <p className="text-[11px] text-gray-500">ID: {item.pc_id}</p>
                                            <p className="text-[11px] text-gray-400">Último reporte: {new Date(item.last_seen).toLocaleString()}</p>
                                            {assigned ? (
                                              <span className="text-[10px] inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-600 mt-1">Ya asignada en inventario</span>
                                            ) : (
                                              <span className="text-[10px] inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-600 mt-1">No asignada</span>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <div className="flex gap-2">
                                              <button
                                                disabled={assigned}
                                                onClick={() => {
                                                  if (assigned) return;
                                                  setSelectedPcIdForForm(item.pc_id);
                                                  setSelectedPcNameForForm(editedName);
                                                  setIsSelectPcModalOpen(false);
                                                }}
                                                className={`px-3 py-2 rounded-lg font-bold text-xs uppercase ${assigned ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                              >
                                                Seleccionar
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setPcLiveId(item.pc_id);
                                                  setIsPcLiveActive(true);
                                                }}
                                                className="px-3 py-2 rounded-lg font-bold text-xs uppercase bg-indigo-600 text-white hover:bg-indigo-700"
                                              >
                                                Ver vivo
                                              </button>
                                            </div>
                                            <div className="flex gap-1">
                                              <input
                                                value={editedName}
                                                onChange={(e) => setPcNameEdits((prev) => ({ ...prev, [item.pc_id]: e.target.value }))}
                                                className="w-full p-1 border rounded-lg text-xs"
                                              />
                                              <button
                                                onClick={() => updatePcAgentName(item.pc_id, editedName)}
                                                className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg"
                                              >
                                                Guardar
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Stock Inicial</label>
                          <input id="prod-stock" type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="0" />
                        </div>
                        <button 
                          onClick={async () => {
                            const name = (document.getElementById('prod-name') as HTMLInputElement).value;
                            const cat = (document.getElementById('prod-cat') as HTMLSelectElement).value;
                            const cost = (document.getElementById('prod-cost') as HTMLInputElement).value;
                            const price = (document.getElementById('prod-price') as HTMLInputElement).value;
                            const stock = (document.getElementById('prod-stock') as HTMLInputElement).value;
                            
                            if (!name) {
                              showNotification('El nombre es obligatorio', 'error');
                              return;
                            }

                            try {
                              await fetchData(); // asegúrate de datos frescos antes de registrar
                              if (cat === 'pc' || cat === 'console') {
                                // Register as Equipment (costo de inversión real sin periféricos)
                                const equipCost = parseFloat(cost || '0');
                                const pcIdVal = selectedPcIdForForm.trim();
                                if (!pcIdVal) {
                                  showNotification('Selecciona una PC desde la lista antes de guardar.', 'error');
                                  return;
                                }
                                // Inmediate refresh y verificación en backend
                                console.log('[PC Register] Inicio verificación', {
                                  pcIdVal,
                                  selectedPcNameForForm,
                                  discoveredPCsCount: discoveredPCs.length,
                                  equipmentCount: equipment.length
                                });

                                const discoveredRes2 = await apiFetch('/api/pc/discovered?freshnessMinutes=0&onlineThresholdMinutes=1');
                                let preservedDiscovered = discoveredPCs;
                                if (discoveredRes2.ok) {
                                  const discoveredData2 = await discoveredRes2.json();
                                  preservedDiscovered = (discoveredData2.data || []).map((pc: any) => ({ ...pc, assigned: !!pc.equipment_id }));
                                }

                                const discoveredEntry = preservedDiscovered.find((n) => n.pc_id === pcIdVal);
                                let assignedCheck = Boolean(discoveredEntry?.assigned);
                                const alreadyAssigned = equipment.some((eq: any) => (eq.type === 'PC' || eq.type === 'Console') && eq.pc_id === pcIdVal);

                                if (assignedCheck && !alreadyAssigned) {
                                  console.warn(`[PC Register] inconsistencia: detected as assigned en discovered pero no existe en equipment, permitiendo registro. pcId=${pcIdVal}`);
                                  assignedCheck = false;
                                }

                                console.log('[PC Register] checks', { pcIdVal, assignedCheck, alreadyAssigned, discoveredEntry });

                                if (alreadyAssigned) {
                                  showNotification(`PC ${pcIdVal} ya está asignada a inventario. Elige otra.`, 'error');
                                  return;
                                }
                                const equipRes = await fetch('/api/equipment', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    name, 
                                    type: cat === 'pc' ? 'PC' : 'Console',
                                    status: 'available',
                                    cost: equipCost,
                                    pc_id: pcIdVal
                                  })
                                });
                                const equipData = await equipRes.json();
                                if (!equipRes.ok) {
                                  console.error('[PC Register] equipment error', { status: equipRes.status, equipData });
                                  throw new Error(equipData.error || 'Error al crear equipo');
                                }
                                const equipmentId = equipData.data?.id || equipData.id;

                                // Register included peripherals
                                for (const peri of formPeripherals) {
                                  if (peri.name && peri.quantity > 0) {
                                    for (let i = 0; i < peri.quantity; i++) {
                                      await fetch('/api/peripherals', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                          name: peri.name + (peri.quantity > 1 ? ` #${i+1}` : ''), 
                                          type: peri.type,
                                          equipment_id: equipmentId,
                                          status: 'available',
                                          cost: peri.cost
                                        })
                                      });
                                    }
                                  }
                                }

                                // Also register as product for pricing logic if needed
                                // Price for rental equipment should be only equipment base price (no peripherals included)
                                const equipmentPrice = parseFloat(price || '0');
                                await fetch('/api/products', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    name, 
                                    category: cat, 
                                    price: equipmentPrice, 
                                    cost: equipCost, 
                                    stock: 1 
                                  })
                                });

                                // Actualizar nombre del agente PC si se cambió
                                await updatePcAgentName(pcIdVal, name);
                              } else {
                                // Standard Product
                                await fetch('/api/products', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    name, 
                                    category: cat, 
                                    price: parseFloat(price || '0'), 
                                    cost: parseFloat(cost || '0'), 
                                    stock: parseInt(stock || '0') 
                                  })
                                });
                              }
                              
                              fetchData();
                              showNotification('Item registrado con éxito', 'success');
                              setSelectedPcIdForForm('');
                              setSelectedPcNameForForm('');
                              
                              // Clear form
                              (document.getElementById('prod-name') as HTMLInputElement).value = '';
                              (document.getElementById('prod-cost') as HTMLInputElement).value = '';
                              (document.getElementById('prod-price') as HTMLInputElement).value = '';
                              (document.getElementById('prod-stock') as HTMLInputElement).value = '';
                              setFormPeripherals([]);
                            } catch (e: any) {
                              console.error('Error al registrar item', e);
                              const msg = e?.message || 'Error al registrar item';
                              showNotification(msg, 'error');
                            }
                          }}
                          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                          Guardar en Inventario
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inventory List */}
                  <div className="col-span-8 space-y-6">
                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="text-2xl font-black">Inventario Global</h3>
                        <div className="flex gap-2">
                          <select 
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="p-2 bg-gray-50 border-none rounded-xl text-xs font-black uppercase tracking-widest"
                          >
                            <option value="all">Todo el Inventario</option>
                            <option value="product">Consumibles</option>
                            <option value="pc">Renta PC</option>
                            <option value="console">Renta Consola</option>
                          </select>
                        </div>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                          <tr>
                            <th className="px-8 py-5">Item</th>
                            <th className="px-8 py-5">Categoría</th>
                            <th className="px-8 py-5">PC ID</th>
                            <th className="px-8 py-5">Estado</th>
                            <th className="px-8 py-5">Inversión</th>
                            <th className="px-8 py-5">Venta</th>
                            <th className="px-8 py-5">Stock</th>
                            <th className="px-8 py-5">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredProducts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-8 py-20 text-center text-gray-400 font-medium">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                No hay items en esta sección.
                              </td>
                            </tr>
                          ) : (
                            filteredProducts.map(product => {
                              const isExpanded = expandedEquipment.includes(product.equipmentId || -1);
                              const itemPeripherals = product.equipmentId ? peripherals.filter(p => p.equipment_id === product.equipmentId) : [];
                              
                              return (
                                <React.Fragment key={`${product.itemType}-${product.id}`}>
                                  <tr className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-8 py-6">
                                      <div className="flex items-center gap-3">
                                        {(product.category === 'pc' || product.category === 'console') && (
                                          <button 
                                            onClick={() => {
                                              if (product.equipmentId) {
                                                setExpandedEquipment(prev => 
                                                  prev.includes(product.equipmentId!) 
                                                    ? prev.filter(id => id !== product.equipmentId)
                                                    : [...prev, product.equipmentId!]
                                                );
                                              }
                                            }}
                                            className="p-1 hover:bg-indigo-50 rounded-lg text-indigo-400 transition-colors"
                                          >
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                          </button>
                                        )}
                                        <span className="font-black text-gray-900">{product.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {product.category === 'pc' ? 'Renta PC' : product.category === 'console' ? 'Renta Consola' : 'Consumible'}
                                      </span>
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">
                                        {product.pcId ? `PC-${product.pcId}` : '—'}
                                      </span>
                                    </td>
                                    <td className="px-8 py-6">
                                      {product.status ? (
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                          product.status === 'available' ? 'bg-emerald-50 text-emerald-600' : 
                                          product.status === 'maintenance' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                          {product.status === 'available' ? 'Disponible' : 
                                           product.status === 'maintenance' ? 'Mantenimiento' : 'Fuera de Servicio'}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300 text-[10px] font-black uppercase tracking-widest">N/A</span>
                                      )}
                                    </td>
                                    <td className="px-8 py-6 text-gray-500 font-bold">${(product.cost || 0).toFixed(2)}</td>
                                    <td className="px-8 py-6 font-black text-indigo-600 text-lg">
                                      {product.price > 0 ? `$${(product.price || 0).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className={`font-black text-lg ${product.stock < 5 ? 'text-red-500' : 'text-gray-900'}`}>
                                        {product.stock}
                                      </span>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="flex items-center gap-4">
                                        {(product.category === 'pc' || product.category === 'console') && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startRental(product.category === 'pc' ? 'PC' : 'Console', product.name, 0);
                                            }}
                                            className="text-emerald-500 hover:text-emerald-700"
                                            title="Rentar ahora"
                                          >
                                            <Monitor size={18} />
                                          </button>
                                        )}
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const isEquip = product.category === 'pc' || product.category === 'console';
                                              setLossItemType(isEquip ? 'equipment' : 'product');
                                              setSelectedLossItemId(isEquip ? (product.equipmentId?.toString() || '') : product.id.toString());
                                              setLossType(isEquip ? 'scrap' : 'merma');
                                              setActiveTab('losses');
                                            }}
                                          className="text-orange-500 hover:text-orange-700"
                                          title="Reportar Baja/Merma"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingItem({ type: 'product', data: product });
                                          }}
                                          className="text-indigo-600 hover:text-indigo-800"
                                          title="Editar item"
                                        >
                                          <History size={18} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteInventoryItem(product.id, 'product');
                                          }}
                                          className="text-red-400 hover:text-red-600"
                                          title="Eliminar item"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && itemPeripherals.map(peri => (
                                    <tr key={`peri-${peri.id}`} className="bg-indigo-50/20 border-l-4 border-indigo-400">
                                      <td className="px-8 py-4 pl-16">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                          <span className="text-sm font-bold text-gray-600">{peri.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-8 py-4">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                          {peri.type}
                                        </span>
                                      </td>
                                      <td className="px-8 py-4">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                          peri.status === 'available' ? 'bg-emerald-50 text-emerald-600' : 
                                          peri.status === 'maintenance' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                          {peri.status === 'available' ? 'Disponible' : 
                                           peri.status === 'maintenance' ? 'Mantenimiento' : 'Fuera de Servicio'}
                                        </span>
                                      </td>
                                      <td className="px-8 py-4 text-gray-400 text-sm font-bold">${peri.cost.toFixed(2)}</td>
                                      <td className="px-8 py-4 text-gray-300">-</td>
                                      <td className="px-8 py-4 text-gray-400 text-sm font-bold">1</td>
                                      <td className="px-8 py-4">
                                        <div className="flex items-center gap-4">
                                          <button 
                                            onClick={() => {
                                              setLossItemType('peripheral');
                                              setSelectedLossItemId(peri.id.toString());
                                              setLossType('scrap');
                                              setActiveTab('losses');
                                            }}
                                            className="text-orange-400 hover:text-orange-600"
                                            title="Reportar Baja"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                          <button 
                                            onClick={() => setEditingItem({ type: 'peripheral', data: peri })}
                                            className="text-indigo-400 hover:text-indigo-600"
                                          >
                                            <History size={16} />
                                          </button>
                                          <button 
                                            onClick={() => deleteInventoryItem(peri.id, 'peripheral')}
                                            className="text-red-300 hover:text-red-500"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'accounting' && (
              <motion.div 
                key="accounting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-10"
              >
                <div className="col-span-4 space-y-8">
                  <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 sticky top-10">
                    <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                      <ArrowRightLeft className="text-red-500" />
                      Registrar Gasto
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descripción</label>
                        <input id="exp-desc" type="text" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold" placeholder="Ej. Pago de Internet Fibra" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monto del Gasto</label>
                        <input id="exp-amt" type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoría Fiscal</label>
                        <select id="exp-cat" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold">
                          <option value="execution">Costo de Ejecución (Luz, Renta, etc)</option>
                          <option value="investment">Inversión en Productos</option>
                          <option value="other">Otros Gastos</option>
                        </select>
                      </div>
                      <button 
                        onClick={async () => {
                          const desc = (document.getElementById('exp-desc') as HTMLInputElement).value;
                          const amt = (document.getElementById('exp-amt') as HTMLInputElement).value;
                          const cat = (document.getElementById('exp-cat') as HTMLSelectElement).value;
                          if (desc && amt) {
                            await fetch('/api/expenses', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ description: desc, amount: parseFloat(amt), category: cat })
                            });
                            fetchData();
                            (document.getElementById('exp-desc') as HTMLInputElement).value = '';
                            (document.getElementById('exp-amt') as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                      >
                        Confirmar Gasto
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 space-y-10">
                  <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-50">
                    <h3 className="text-2xl font-black">Catálogo Taecel</h3>
                    <p className="text-sm text-gray-500">Consulta el catálogo de servicios Taecel y carga la tabla oficial.</p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          setIsTaecelCatalogModalOpen(true);
                          fetchTaecelCatalog();
                        }}
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                      >Abrir Catálogo</button>

                      <button
                        onClick={() => fetchTaecelCatalog()}
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                      >Refrescar Catálogo</button>

                      <button
                        onClick={() => fetchTaecelHistory('ALL')}
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                      >Historial Taecel</button>

                      <button
                        onClick={() => fetchTaecelCatalog()}
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                      >Actualizar</button>
                    </div>

                    {taecelCatalogCount && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-100 rounded-xl">Bolsas: {taecelCatalogCount.bolsas}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-xl">Categorías: {taecelCatalogCount.categorias}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-xl">Carriers: {taecelCatalogCount.carriers}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-xl">Productos: {taecelCatalogCount.productos}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-xl">Únicos: {taecelCatalogCount.productosUnicos}</span>
                      </div>
                    )}
                  </div>

                    <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                      <div className="flex items-center gap-6">
                        <h3 className="text-2xl font-black">Libro de Gastos</h3>
                        <div className="flex bg-gray-50 p-1 rounded-xl">
                          {['all', 'execution', 'investment', 'loss', 'other'].map(cat => (
                            <button
                              key={cat}
                              onClick={() => setExpenseFilter(cat)}
                              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                expenseFilter === cat ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              {cat === 'all' ? 'Todos' : cat === 'execution' ? 'Ejecución' : cat === 'investment' ? 'Inversión' : cat === 'loss' ? 'Pérdidas' : 'Otros'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="text-gray-400 font-bold text-sm">Total: ${expenses.filter(e => expenseFilter === 'all' || e.category === expenseFilter).reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                    </div>
                    <div className="p-0">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                          <tr>
                            <th className="px-8 py-5">Descripción</th>
                            <th className="px-8 py-5">Categoría</th>
                            <th className="px-8 py-5">Monto</th>
                            <th className="px-8 py-5">Fecha</th>
                            <th className="px-8 py-5">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {expenses.filter(e => expenseFilter === 'all' || e.category === expenseFilter).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium">
                                <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-20" />
                                No hay gastos registrados en esta categoría.
                              </td>
                            </tr>
                          ) : (
                            expenses.filter(e => expenseFilter === 'all' || e.category === expenseFilter).map(expense => (
                              <tr key={expense.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-8 py-6 font-black text-gray-900">{expense.description}</td>
                                <td className="px-8 py-6">
                                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                    expense.category === 'investment' ? 'bg-blue-50 text-blue-600' : 
                                    expense.category === 'execution' ? 'bg-orange-50 text-orange-600' : 
                                    expense.category === 'loss' ? 'bg-red-50 text-red-600' :
                                    'bg-gray-50 text-gray-600'
                                  }`}>
                                    {expense.category === 'investment' ? 'Inversión' : 
                                     expense.category === 'execution' ? 'Ejecución' : 
                                     expense.category === 'loss' ? 'Pérdida' : 'Otro'}
                                  </span>
                                </td>
                                <td className="px-8 py-6 font-black text-red-500 text-lg">-${expense.amount.toFixed(2)}</td>
                                <td className="px-8 py-6 text-gray-400 font-medium text-sm">
                                  {new Date(expense.timestamp).toLocaleDateString()}
                                </td>
                                <td className="px-8 py-6">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteExpense(expense.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                    title="Eliminar gasto"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="text-2xl font-black">Libro de Ventas</h3>
                      <span className="text-gray-400 font-bold text-sm">Total: ${sales.reduce((s, e) => s + e.total, 0).toFixed(2)}</span>
                    </div>
                    <div className="p-0">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                          <tr>
                            <th className="px-8 py-5">ID Venta</th>
                            <th className="px-8 py-5">Tipo</th>
                            <th className="px-8 py-5">Monto</th>
                            <th className="px-8 py-5">Fecha</th>
                            <th className="px-8 py-5">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sales.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium">
                                <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
                                No hay ventas registradas.
                              </td>
                            </tr>
                          ) : (
                            sales.map(sale => (
                              <tr key={sale.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-8 py-6 font-black text-gray-900">#{sale.id}</td>
                                <td className="px-8 py-6">
                                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                    sale.type === 'rental' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {sale.type === 'rental' ? 'Renta' : 'Venta Directa'}
                                  </span>
                                </td>
                                <td className="px-8 py-6 font-black text-emerald-600 text-lg">${sale.total.toFixed(2)}</td>
                                <td className="px-8 py-6 text-gray-400 font-medium text-sm">
                                  {new Date(sale.timestamp).toLocaleString()}
                                </td>
                                <td className="px-8 py-6">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSale(sale.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                    title="Eliminar venta"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'sales' && (
              <motion.div
                key="sales"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-10"
              >
                <div className="col-span-12">
                  <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                    <h3 className="text-2xl font-black">Ventas Totales</h3>
                    <div className="flex gap-2 text-xs">
                      {['all', 'consumables', 'rentals', 'taecel'].map((option) => (
                        <button
                          key={option}
                          onClick={() => setSalesViewFilter(option as any)}
                          className={`px-3 py-2 rounded-lg font-black uppercase tracking-widest transition ${
                            salesViewFilter === option ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {option === 'all' ? 'Todo' : option === 'consumables' ? 'Consumibles' : option === 'rentals' ? 'Rentas' : 'Taecel'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          fetchData();
                          fetchTaecelSales();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition"
                      >Refrescar</button>
                    </div>
                  </div>

                  <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <span className="text-sm text-gray-500">Combinado: Consumibles + Rentas + Taecel</span>
                      {(taecelSalesLoading || (processSpinner && processSpinner)) && <span className="text-indigo-600 font-black">Cargando...</span>}
                      {taecelSalesError && <span className="text-red-600 font-black">{taecelSalesError}</span>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3">Referencia</th>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3">Monto</th>
                            <th className="px-4 py-3">Respuesta</th>
                            <th className="px-4 py-3">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredCombinedSales.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-medium">
                                No hay ventas para esta categoría.
                              </td>
                            </tr>
                          ) : (
                            filteredCombinedSales.map((item: any) => (
                              <tr key={`${item.source}-${item.id}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-black text-gray-900">{item.tipo}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{item.referencia}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{item.producto}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{item.codigo}</td>
                                <td className="px-4 py-3 text-sm text-emerald-600 font-black">${Number(item.monto).toFixed(2)}</td>
                                <td className={`px-4 py-3 text-sm font-black ${item.respuesta === 'SUCCESS' ? 'text-emerald-600' : item.respuesta === 'PENDING' ? 'text-amber-600' : 'text-red-600'}`}>{item.respuesta}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{item.fecha || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'losses' && (
              <motion.div 
                key="losses"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-10"
              >
                <div className="col-span-4 space-y-8">
                  <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 sticky top-10">
                    <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                      <Trash2 className="text-red-500" />
                      Reportar Baja
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Item</label>
                        <select 
                          id="loss-item-type" 
                          value={lossItemType}
                          onChange={(e) => {
                            setLossItemType(e.target.value as any);
                            setSelectedLossItemId('');
                          }}
                          className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold"
                        >
                          <option value="product">Producto (Consumible)</option>
                          <option value="equipment">Equipo (PC/Consola)</option>
                          <option value="peripheral">Periférico (Control/Headset)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seleccionar Item</label>
                        <select 
                          id="loss-prod" 
                          value={selectedLossItemId}
                          onChange={(e) => setSelectedLossItemId(e.target.value)}
                          className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold"
                        >
                          <option value="">Seleccionar...</option>
                          {lossItemType === 'product' && products.filter(p => p.category === 'product').map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          {lossItemType === 'equipment' && equipment.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                          ))}
                          {lossItemType === 'peripheral' && peripherals.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cantidad</label>
                          <input id="loss-qty" type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold" placeholder="1" defaultValue="1" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Baja</label>
                          <select 
                            id="loss-type" 
                            value={lossType}
                            onChange={(e) => setLossType(e.target.value as any)}
                            className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold"
                          >
                            <option value="merma">Merma (Consumibles)</option>
                            <option value="scrap">Baja (Equipo/Periférico)</option>
                            <option value="damage">Daño (Reparación)</option>
                          </select>
                        </div>
                      </div>

                      {lossItemType === 'equipment' && (
                        <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Baja de Equipo</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="full-equipment-loss"
                              checked={equipmentFullLoss}
                              onChange={(e) => setEquipmentFullLoss(e.target.checked)}
                              className="h-4 w-4 text-red-600 border-gray-300 rounded"
                            />
                            <label htmlFor="full-equipment-loss" className="text-xs font-bold text-gray-500">
                              Dar de baja PC/Consola + todos sus periféricos (costo total equipo+periféricos)
                            </label>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Motivo / Descripción</label>
                        <textarea id="loss-reason" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold h-24" placeholder="Ej. Mouse con cable roto, Refresco caducado..." />
                      </div>
                      <button 
                        onClick={async () => {
                          const itemType = lossItemType;
                          const qty = (document.getElementById('loss-qty') as HTMLInputElement).value;
                          const type = lossType;
                          const reason = (document.getElementById('loss-reason') as HTMLTextAreaElement).value;
                          
                          if (!selectedLossItemId || !qty || !reason) {
                            showNotification('Completa todos los campos', 'error');
                            return;
                          }

                          const connectLoss = async (payload: any) => {
                            const res = await fetch('/api/losses', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                            });
                            if (!res.ok) {
                              throw new Error('Error al registrar baja');
                            }
                            return res;
                          };

                          try {
                            if (lossItemType === 'equipment' && equipmentFullLoss) {
                              const equipmentId = parseInt(selectedLossItemId);
                              const equip = equipment.find((e: any) => e.id === equipmentId);

                              if (!equip) throw new Error('Equipo no encontrado');

                              // Registrar baja del equipo
                              await connectLoss({
                                equipment_id: equipmentId,
                                quantity: parseInt(qty),
                                type,
                                reason: `${reason} (Baja total de equipo)`,
                                cost: equip.cost || 0
                              });

                              // Registrar baja de periféricos vinculados
                              const matchedPeripherals = peripherals.filter((p: any) => p.equipment_id === equipmentId);
                              for (const perif of matchedPeripherals) {
                                await connectLoss({
                                  peripheral_id: perif.id,
                                  quantity: 1,
                                  type,
                                  reason: `${reason} (Periférico de equipo)`,
                                  cost: perif.cost || 0
                                });
                              }
                            } else {
                              const body: any = {
                                quantity: parseInt(qty),
                                type,
                                reason
                              };

                              if (lossItemType === 'product') body.product_id = parseInt(selectedLossItemId);
                              else if (lossItemType === 'equipment') body.equipment_id = parseInt(selectedLossItemId);
                              else if (lossItemType === 'peripheral') body.peripheral_id = parseInt(selectedLossItemId);

                              await connectLoss(body);
                            }

                            fetchData();
                            showNotification('Baja registrada correctamente', 'success');

                            // Clear form
                            setSelectedLossItemId('');
                            setLossItemType('product');
                            setLossType('merma');
                            setEquipmentFullLoss(false);
                            (document.getElementById('loss-qty') as HTMLInputElement).value = '1';
                            (document.getElementById('loss-reason') as HTMLTextAreaElement).value = '';
                          } catch (error: any) {
                            showNotification(error?.message || 'Error al registrar baja', 'error');
                          }
                        }}
                        className="w-full bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                      >
                        Registrar Pérdida
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="text-2xl font-black">Historial de Bajas</h3>
                    <span className="text-red-500 font-black text-sm uppercase tracking-widest">Pérdida Total: ${losses.reduce((s, l) => s + l.amount, 0).toFixed(2)}</span>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                        <tr>
                          <th className="px-8 py-5">Item</th>
                          <th className="px-8 py-5">Tipo</th>
                          <th className="px-8 py-5">Cant.</th>
                          <th className="px-8 py-5">Motivo</th>
                          <th className="px-8 py-5">Valor</th>
                          <th className="px-8 py-5">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {losses.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-medium">
                              <Trash2 size={48} className="mx-auto mb-4 opacity-20" />
                              No hay bajas registradas.
                            </td>
                          </tr>
                        ) : (
                          losses.map(loss => (
                            <tr key={loss.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-8 py-6">
                                <p className="font-black text-gray-900">
                                  {loss.product_name || loss.equipment_name || loss.peripheral_name}
                                </p>
                                <p className="text-[10px] text-gray-400">{new Date(loss.timestamp).toLocaleString()}</p>
                              </td>
                              <td className="px-8 py-6">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                  loss.type === 'merma' ? 'bg-orange-50 text-orange-600' : 
                                  loss.type === 'scrap' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {loss.type === 'merma' ? 'Merma' : loss.type === 'scrap' ? 'Baja' : 'Daño'}
                                </span>
                              </td>
                              <td className="px-8 py-6 font-bold text-gray-600">x{loss.quantity}</td>
                              <td className="px-8 py-6 text-gray-500 text-sm italic">"{loss.reason}"</td>
                              <td className="px-8 py-6 font-black text-red-500">-${loss.amount.toFixed(2)}</td>
                              <td className="px-8 py-6">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteLoss(loss.id);
                                  }}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                  title="Eliminar registro"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                className="space-y-10"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Rendimiento</h3>
                    <p className="text-gray-400 font-medium">Resumen general de operaciones y finanzas.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Desde</span>
                        <input 
                          type="date" 
                          value={reportRange.start}
                          onChange={(e) => setReportRange(prev => ({ ...prev, start: e.target.value }))}
                          className="text-xs font-black text-indigo-600 focus:outline-none"
                        />
                      </div>
                      <div className="w-px h-8 bg-gray-100 mx-1" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Hasta</span>
                        <input 
                          type="date" 
                          value={reportRange.end}
                          onChange={(e) => setReportRange(prev => ({ ...prev, end: e.target.value }))}
                          className="text-xs font-black text-indigo-600 focus:outline-none"
                        />
                      </div>
                      <button 
                        onClick={generateReport}
                        className="ml-4 p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                        title="Generar Reporte"
                      >
                        <FileText size={20} />
                      </button>
                    </div>

                    <button 
                      onClick={() => setIsCashOutModalOpen(true)}
                      className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-indigo-600 transition-all flex items-center gap-3"
                    >
                      <ReceiptText size={20} />
                      Corte de Caja
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-8">
                  <StatCard title="Ingresos Totales" value={`$${summary?.revenue?.toFixed(2) || '0.00'}`} color="text-green-600" icon={<TrendingUp size={24} />} subtitle="Ventas acumuladas" />
                  <StatCard title="Gastos Totales" value={`$${summary?.expenses?.toFixed(2) || '0.00'}`} color="text-red-500" icon={<ArrowRightLeft size={24} />} subtitle="Inversión + Operación" />
                  <StatCard title="Inversión Prod." value={`$${summary?.investment?.toFixed(2) || '0.00'}`} color="text-blue-500" icon={<Package size={24} />} subtitle="Activos y Stock" />
                  <StatCard title="Utilidad Neta" value={`$${summary?.profit?.toFixed(2) || '0.00'}`} color="text-indigo-600" icon={<Calculator size={24} />} subtitle="Balance final" />
                </div>

                <div className="grid grid-cols-3 gap-10">
                  <div className="col-span-2 space-y-8">
                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black">Distribución de Gastos</h3>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Ejecución</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Inversión</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Pérdidas</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-8">
                        <ProgressBar 
                          label="Costos de Operación (Ejecución)" 
                          value={summary && summary.expenses > 0 ? (summary.execution / summary.expenses) * 100 : 0} 
                          color="bg-orange-400" 
                        />
                        <ProgressBar 
                          label="Inversión en Activos y Stock" 
                          value={summary && summary.expenses > 0 ? (summary.investment / summary.expenses) * 100 : 0} 
                          color="bg-blue-400" 
                        />
                        <ProgressBar 
                          label="Pérdidas (Mermas y Daños)" 
                          value={summary && summary.expenses > 0 ? (summary.losses / summary.expenses) * 100 : 0} 
                          color="bg-red-400" 
                        />
                        <ProgressBar 
                          label="Otros Gastos Administrativos" 
                          value={summary && summary.expenses > 0 ? ((summary.expenses - summary.execution - summary.investment - summary.losses) / summary.expenses) * 100 : 0} 
                          color="bg-indigo-400" 
                        />
                      </div>
                    </div>

                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                      <h3 className="text-2xl font-black mb-8">Punto de Equilibrio</h3>
                      <div className="space-y-6">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Ingresos vs Gastos</p>
                            <p className="text-3xl font-black text-gray-900">${summary?.revenue?.toFixed(2) || '0.00'} / ${summary?.expenses?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Estado</p>
                            <p className={`text-lg font-black ${summary && summary.revenue >= summary.expenses ? 'text-green-500' : 'text-orange-500'}`}>
                              {summary && summary.revenue >= summary.expenses ? 'Recuperado' : 'En Proceso'}
                            </p>
                          </div>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${summary ? Math.min((summary.revenue / summary.expenses) * 100, 100) : 0}%` }}
                            className={`h-full ${summary && summary.revenue >= summary.expenses ? 'bg-green-500' : 'bg-indigo-500'}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-lg font-black mb-6 flex items-center gap-2">
                          <Package className="text-indigo-500" size={20} />
                          Productos Top
                        </h4>
                        <div className="space-y-4">
                          {summary?.topProducts?.map((p, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <span className="text-sm font-bold text-gray-600">{p.name}</span>
                              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black">x{p.count}</span>
                            </div>
                          ))}
                          {(!summary?.topProducts || summary.topProducts.length === 0) && (
                            <p className="text-center text-gray-400 text-sm py-4">No hay datos de ventas.</p>
                          )}
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h4 className="text-lg font-black mb-6 flex items-center gap-2">
                          <Monitor className="text-pink-500" size={20} />
                          Equipos Más Rentados
                        </h4>
                        <div className="space-y-4">
                          {summary?.topEquipment?.map((e, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <span className="text-sm font-bold text-gray-600">{e.identifier}</span>
                              <span className="bg-pink-50 text-pink-600 px-3 py-1 rounded-full text-[10px] font-black">{e.rental_count} rentas</span>
                            </div>
                          ))}
                          {(!summary?.topEquipment || summary.topEquipment.length === 0) && (
                            <p className="text-center text-gray-400 text-sm py-4">No hay datos de rentas.</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black">Actividad Reciente</h3>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-400 uppercase">Últimos movimientos</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Últimas Ventas</h4>
                          {sales.slice(0, 5).map(sale => (
                            <div key={sale.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                              <div>
                                <p className="text-sm font-black text-gray-800">${sale.total.toFixed(2)}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{new Date(sale.date).toLocaleTimeString()}</p>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${sale.type === 'rental' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {sale.type}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Últimos Gastos</h4>
                          {expenses.slice(0, 5).map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                              <div>
                                <p className="text-sm font-black text-red-500">-${exp.amount.toFixed(2)}</p>
                                <p className="text-[10px] text-gray-400 font-bold truncate max-w-[120px]">{exp.description}</p>
                              </div>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                                {exp.category}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-gray-900 p-10 rounded-[40px] shadow-2xl shadow-gray-200 flex flex-col items-center justify-center text-center space-y-6 text-white">
                      <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center text-indigo-400">
                        <TrendingUp size={48} />
                      </div>
                      <div>
                        <p className="text-indigo-300 font-black uppercase tracking-widest text-xs mb-2">Eficiencia Operativa</p>
                        <p className="text-5xl font-black">
                          {summary && summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 100) : 0}%
                        </p>
                        <p className="text-white/40 text-sm mt-4 font-medium">Margen de ganancia sobre ingresos totales.</p>
                      </div>
                    </div>

                    <div className="bg-indigo-600 p-10 rounded-[40px] shadow-2xl shadow-indigo-200 text-white">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-white/10 rounded-2xl">
                          <Calculator size={24} />
                        </div>
                        <h4 className="font-black text-xl">Ganancia Real</h4>
                      </div>
                      <p className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2">Utilidad Neta (Post-Inversión)</p>
                      <p className="text-4xl font-black mb-4">${(summary ? summary.revenue - summary.expenses : 0).toFixed(2)}</p>
                      <div className="pt-6 border-t border-white/10">
                        <p className="text-white/60 text-xs font-medium leading-relaxed">
                          Esta cifra representa el dinero que te queda libre después de haber pagado luz, renta, sueldos y haber recuperado la inversión de los productos comprados.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {renderMaintenanceModal()}
      {renderRentalModal()}
      {renderServiceModal()}
      {renderTaecelCatalogModal()}
      {renderTicket()}
      {renderTimeOverAlert()}
      {renderConfirmModal()}
      {renderWarningModal()}
      {renderNotification()}
      {renderEditItemModal()}
      {processSpinner && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center">
          <div className="bg-white/90 p-6 rounded-3xl flex items-center gap-3 shadow-xl border border-gray-200">
            <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-black text-gray-800">Procesando... por favor espera</span>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CategoryTab({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest whitespace-nowrap transition-all ${
      active 
        ? 'bg-gray-900 text-white shadow-xl shadow-gray-200' 
        : 'bg-white text-gray-400 border border-gray-100 hover:border-indigo-200 hover:text-indigo-600'
    }`}>
      {icon}
      {label}
    </button>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void; key?: React.Key }) {
  const getIcon = () => {
    if (product.category === 'pc') return <Monitor size={40} strokeWidth={1.5} />;
    if (product.category === 'console') return <Gamepad2 size={40} strokeWidth={1.5} />;
    if (product.category === 'controller') return <Gamepad2 size={40} strokeWidth={1.5} />;
    if (product.category === 'mouse') return <MousePointer2 size={40} strokeWidth={1.5} />;
    if (product.category === 'keyboard') return <Keyboard size={40} strokeWidth={1.5} />;
    if (product.category === 'headset') return <Headphones size={40} strokeWidth={1.5} />;
    if (product.category === 'recharge') return <Smartphone size={40} strokeWidth={1.5} />;
    if (product.category === 'service') return <Receipt size={40} strokeWidth={1.5} />;
    if (product.category === 'giftcard') return <Gift size={40} strokeWidth={1.5} />;
    return <Package size={40} strokeWidth={1.5} />;
  };

  const getColor = () => {
    if (product.category === 'pc') return 'text-blue-500 bg-blue-50';
    if (product.category === 'console') return 'text-pink-500 bg-pink-50';
    if (product.category === 'recharge') return 'text-indigo-500 bg-indigo-50';
    if (product.category === 'service') return 'text-orange-500 bg-orange-50';
    if (product.category === 'giftcard') return 'text-purple-500 bg-purple-50';
    if (['controller', 'mouse', 'keyboard', 'headset'].includes(product.category)) return 'text-indigo-500 bg-indigo-50';
    return 'text-emerald-500 bg-emerald-50';
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden"
    >
      <div className={`w-full aspect-square rounded-2xl mb-6 flex items-center justify-center transition-colors ${getColor()}`}>
        {getIcon()}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{product.category}</p>
        <h4 className="font-black text-gray-900 text-lg leading-tight">{product.name}</h4>
      </div>
      <div className="flex justify-between items-center mt-6">
        <span className="font-black text-2xl text-indigo-600">${(product.price || 0).toFixed(2)}</span>
        <button 
          onClick={onAdd}
          className="bg-gray-900 text-white p-3 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg shadow-gray-200 hover:shadow-indigo-200"
        >
          <Plus size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function EquipmentStationCard({ station, peripherals, activeRental, onStart, onView, onUnblock }: { station: any; peripherals: any[]; activeRental?: Rental; onStart: () => void; onView: () => void; onUnblock: () => void; key?: React.Key }) {
  const isBlocked = station.status === 'blocked';
  const isOccupied = !!activeRental || station.status === 'rented';
  
  return (
    <button 
      onClick={isOccupied ? onView : onStart}
      className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group ${
        isOccupied 
          ? 'border-red-100 bg-red-50/30' 
          : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
      }`}
    >
      <div className={`p-3 rounded-xl ${isOccupied ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
        {(station.category === 'pc' || station.type === 'PC') ? <Monitor size={24} /> : <Gamepad2 size={24} />}
      </div>
      <div className="text-center">
        <p className="font-black text-sm text-gray-900">{station.name}</p>
        {station.pc_id && (
          <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600">PC ID: {station.pc_id}</p>
        )}
        <p className={`text-[10px] font-black uppercase tracking-widest ${isOccupied ? 'text-red-500' : 'text-gray-400'}`}>
          {isOccupied ? 'Ocupado' : 'Disponible'}
        </p>
      </div>
      
      {peripherals.length > 0 && (
        <div className="flex gap-1 mt-1">
          {peripherals.map(p => {
            if (p.type === 'Controller') return <Gamepad2 key={p.id} size={10} className="text-gray-400" />;
            if (p.type === 'Mouse') return <MousePointer2 key={p.id} size={10} className="text-gray-400" />;
            if (p.type === 'Keyboard') return <Keyboard key={p.id} size={10} className="text-gray-400" />;
            if (p.type === 'Headset') return <Headphones key={p.id} size={10} className="text-gray-400" />;
            return null;
          })}
        </div>
      )}

      {isBlocked && (
        <div className="mt-2 p-2 border border-red-200 bg-red-50 rounded-lg text-center">
          <p className="text-xs font-black text-red-700">ESTACIÓN BLOQUEADA</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnblock();
            }}
            className="mt-1 px-2 py-1 bg-red-500 text-white text-[10px] rounded-lg font-black hover:bg-red-600"
          >
            Desbloquear
          </button>
        </div>
      )}

      {isOccupied && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </button>
  );
}

function RentalActionCard({ icon, title, color, onClick }: { icon: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} p-6 rounded-3xl text-white flex flex-col items-center justify-center gap-3 shadow-lg hover:scale-105 transition-transform`}
    >
      {icon}
      <span className="font-black text-lg">{title}</span>
    </button>
  );
}

function ActiveRentalCard({ 
  rental, 
  onComplete, 
  addItemToRental, 
  onRemoveLimit,
  onFreeze,
  onAddTime,
  onReduceTime,
  onCancel,
  onUnblock,
  onSendCommand
}: { 
  rental: Rental; 
  onComplete: () => void; 
  addItemToRental: () => void; 
  onRemoveLimit: () => void;
  onFreeze: () => void;
  onAddTime: () => void;
  onReduceTime: () => void;
  onCancel: (rental: Rental) => void;
  onUnblock: () => void;
  onSendCommand: (pcId: string, command: string, payload?: any) => void;
  key?: React.Key 
}) {
  const [elapsed, setElapsed] = useState('');
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    const parseDate = (d: string) => {
      if (!d) return new Date();
      if (d.includes(' ') && !d.includes('T')) return new Date(d.replace(' ', 'T') + 'Z');
      return new Date(d);
    };

    if (rental.is_frozen) {
      const val = rental.remaining_seconds || 0;
      const isOver = rental.limit_minutes > 0 && val <= 0;
      setIsOvertime(isOver);
      
      const absVal = Math.abs(val);
      const h = Math.floor(absVal / 3600);
      const m = Math.floor((absVal % 3600) / 60);
      const s = absVal % 60;
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      return;
    }

    const timer = setInterval(() => {
      const start = parseDate(rental.start_time).getTime();
      const now = new Date().getTime();
      
      if (rental.limit_minutes > 0) {
        const limitMs = rental.limit_minutes * 60000;
        const end = start + limitMs;
        const diff = end - now;
        
        if (diff <= 0) {
          if (!isOvertime) {
            setIsOvertime(true);
          }
          const over = Math.abs(diff);
          const h = Math.floor(over / 3600000);
          const m = Math.floor((over % 3600000) / 60000);
          const s = Math.floor((over % 60000) / 1000);
          setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
          setIsOvertime(false);
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      } else {
        const diff = now - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [rental.start_time, rental.limit_minutes, rental.is_frozen, rental.remaining_seconds]);

  return (
    <div className={`bg-white border-2 rounded-2xl p-6 space-y-4 transition-colors ${rental.is_frozen ? 'border-blue-200 bg-blue-50/20' : isOvertime ? 'border-red-200 bg-red-50/20' : 'border-indigo-100'}`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-black text-xl text-indigo-900">{rental.identifier}</h4>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase">{rental.type}</p>
            {rental.limit_minutes > 0 && (
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                {rental.limit_minutes}m
              </span>
            )}
            {rental.is_frozen && (
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                Congelado
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`px-4 py-2 rounded-xl font-mono shadow-inner transition-all duration-300 ${
            rental.is_frozen 
              ? 'bg-blue-500 text-white' 
              : isOvertime 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-indigo-50 text-indigo-600'
          }`}>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-tighter opacity-80 leading-none mb-1">
                {rental.is_frozen 
                  ? 'Pausado' 
                  : rental.limit_minutes > 0 
                    ? (isOvertime ? 'Excedido' : 'Restante') 
                    : 'Transcurrido'}
              </span>
              <span className="text-xl font-black leading-none">{elapsed}</span>
            </div>
          </div>
          {rental.limit_minutes > 0 && (
            <div className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase shadow-sm">
              Plan: {rental.limit_minutes} min
            </div>
          )}
        </div>
      </div>

      {isOvertime && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col items-center gap-2">
          <img src={DEFAULT_PC_BLOCKED_IMAGE_URL} alt="PC bloqueada" className="w-full h-28 object-cover rounded-lg" />
          <p className="text-red-700 font-black">TIEMPO AGOTADO. PC BLOQUEADA.</p>
          <button
            onClick={onUnblock}
            className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-700"
          >
            Desbloquear PC
          </button>
        </div>
      )}

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Anticipo:</span>
        <span className="font-bold text-green-600">${(rental.advance_payment || 0).toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onComplete}
          className="bg-indigo-600 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors text-sm"
        >
          <History size={16} /> Cobrar
        </button>
        <button 
          onClick={addItemToRental}
          className="bg-gray-100 text-gray-600 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors text-sm"
        >
          <Plus size={16} /> Item
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <button
          onClick={() => {
            const pcId = rental.equipment_pc_id || rental.identifier;
            onSendCommand(pcId, 'lock', { reason: 'rent-timeout' });
          }}
          className="bg-red-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
        >
          Bloquear PC
        </button>
        <button
          onClick={() => {
            const pcId = rental.equipment_pc_id || rental.identifier;
            onSendCommand(pcId, 'unlock');
          }}
          className="bg-green-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all"
        >
          Desbloquear PC
        </button>
        <button
          onClick={() => {
            const msg = prompt('Mensaje para pantalla de PC:');
            if (msg) {
              const pcId = rental.equipment_pc_id || rental.identifier;
              onSendCommand(pcId, 'message', { text: msg });
            }
          }}
          className="bg-blue-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
        >
          Mensaje Remoto
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onAddTime}
          className="bg-emerald-50 text-emerald-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Agregar Tiempo
        </button>
        <button 
          onClick={onReduceTime}
          className="bg-orange-50 text-orange-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
        >
          <X size={14} /> Reducir Tiempo
        </button>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={onFreeze}
          className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${
            rental.is_frozen ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {rental.is_frozen ? "Reanudar" : "Congelar"}
        </button>
        <button 
          onClick={() => onCancel(rental)}
          className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
        >
          Cancelar
        </button>
        {rental.limit_minutes > 0 && (
          <button 
            onClick={onRemoveLimit}
            className="flex-1 bg-white border border-gray-200 text-gray-400 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
          >
            Libre
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color, icon, subtitle }: { title: string; value: string; color: string; icon: React.ReactNode; subtitle?: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
          {icon}
        </div>
      </div>
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 font-bold mt-2">{subtitle}</p>}
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-black uppercase tracking-widest">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-800">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
