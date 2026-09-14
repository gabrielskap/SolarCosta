// Ícones que o conteúdo do site pode referenciar POR NOME.
//
// Antes do CMS, conteudo.ts guardava o componente lucide direto
// (`Icone: IconeCasa`). Um jsonb não guarda função, então o banco guarda a
// string e este mapa resolve. O catálogo é fechado de propósito: importar o
// pacote inteiro do lucide colocaria ~1500 ícones no bundle da home para que o
// administrador use uma dúzia.
//
// Acrescentar um ícone = uma linha aqui. Nome desconhecido não quebra nada:
// `icone()` cai num ponto de interrogação, que é visível no editor e discreto
// no site.

import {
  Activity,
  Award,
  Battery,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  HardHat,
  HelpCircle,
  Home,
  Info,
  Leaf,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  PencilRuler,
  Phone,
  Plug,
  Ruler,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  ThumbsUp,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const ICONES: Record<string, LucideIcon> = {
  Activity,
  Award,
  Battery,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  HardHat,
  HelpCircle,
  Home,
  Info,
  Leaf,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  PencilRuler,
  Phone,
  Plug,
  Ruler,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  ThumbsUp,
  TrendingUp,
  Users,
  Wrench,
  Zap,
};

/** Nomes disponíveis, para o seletor de ícone do editor. */
export const NOMES_ICONES = Object.keys(ICONES).sort();

/** Resolve um nome vindo do banco. Desconhecido vira HelpCircle. */
export function icone(nome: unknown): LucideIcon {
  return (typeof nome === 'string' && ICONES[nome]) || HelpCircle;
}
