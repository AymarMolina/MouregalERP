import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Ban,
  Calendar,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  FileSpreadsheet,
  Check,
  CircleCheck,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Flower2,
  Gift,
  History,
  Link,
  LogOut,
  LucideAngularModule,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  MessageCircleQuestionMark,
  Minus,
  Package,
  Pencil,
  Phone,
  Plug,
  Plus,
  ReceiptText,
  Ribbon,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  Store,
  Ticket,
  Trash2,
  TriangleAlert,
  Truck,
  User,
  X,
} from "lucide-angular";

/**
 * Íconos de Lucide (https://lucide.dev) con nombres propios del ERP, para que
 * las pantallas no dependan del nombre en inglés de cada ícono. Heredan el
 * color del texto (currentColor).
 */
const ICONOS = {
  // Navegación
  mapa: Map,
  hoy: Activity,
  nuevo: Plus,
  pagos: CreditCard,
  delivery: Truck,
  produccion: Sprout,
  inventario: Package,
  compras: ShoppingCart,
  recetas: ClipboardList,
  reglas: ArrowUpDown,
  tarifario: MapPin,
  integraciones: Plug,
  reportes: ChartColumn,
  buscar: Search,
  salir: LogOut,
  // KPIs y estados
  ventas: DollarSign,
  ticket: Ticket,
  pedido: ReceiptText,
  alerta: TriangleAlert,
  consulta: MessageCircleQuestionMark,
  flecha: ArrowRight,
  menu: Menu,
  // Kiosko de pedidos
  flor: Flower2,
  regalo: Gift,
  papel: Ribbon,
  calendario: Calendar,
  reloj: Clock,
  usuario: User,
  tienda: Store,
  bolsa: ShoppingBag,
  menos: Minus,
  // Acciones
  editar: Pencil,
  eliminar: Trash2,
  cerrar: X,
  copiar: Copy,
  historial: History,
  check: Check,
  confirmar: CircleCheck,
  anular: Ban,
  restaurar: RotateCcw,
  telefono: Phone,
  whatsapp: MessageCircle,
  enlace: Link,
  mas: Ellipsis,
  izquierda: ChevronLeft,
  derecha: ChevronRight,
  descargar: Download,
  excel: FileSpreadsheet,
} as const;

export type NombreIcono = keyof typeof ICONOS;

@Component({
  selector: "app-icon",
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lucide-icon [img]="icono" [size]="size" [strokeWidth]="1.75" aria-hidden="true" />`,
  host: { class: "inline-flex shrink-0" },
})
export class IconComponent {
  @Input({ required: true }) name!: NombreIcono;
  @Input() size = 18;

  get icono() {
    return ICONOS[this.name];
  }
}
