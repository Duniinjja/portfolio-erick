import project1 from '../assets/project1.jpeg';
import project2 from '../assets/project2.jpeg';
import project3 from '../assets/project3.jpeg';
import contributions from './contributions.json';

export const contact = {
    email: 'erick.nascimento12@hotmail.com',
    whatsapp: 'https://api.whatsapp.com/send?phone=5511978289528',
    phone: '(11) 97828-9528',
    linkedin: 'https://www.linkedin.com/in/erickalvesn/',
    github: 'https://github.com/Duniinjja',
    kaggle: 'https://www.kaggle.com/erickalves12',
    cv: '/curriculo.pdf',
    city: 'São Paulo/SP, Brasil',
};

export const navItems = [
    { id: 'sobre', label: 'Sobre' },
    { id: 'woltek', label: 'Woltek' },
    { id: 'projetos', label: 'Projetos' },
    { id: 'experiencia', label: 'Experiência' },
    { id: 'arcade', label: 'Arcade' },
    { id: 'contato', label: 'Contato' },
];

export const socials = [
    { label: 'LinkedIn', href: contact.linkedin, icon: 'linkedin' },
    { label: 'GitHub', href: contact.github, icon: 'github' },
    { label: 'Kaggle', href: contact.kaggle, icon: 'kaggle' },
    { label: 'WhatsApp', href: contact.whatsapp, icon: 'whatsapp' },
] as const;

/** Palavras que se alternam na frase do topo. */
export const heroWords = ['plataformas SaaS', 'sistemas de gestão', 'automações', 'dashboards', 'produtos'];

/* ---------- Woltek (dados de woltek.com.br) ---------- */

export const woltek = {
    site: 'https://woltek.com.br/',
    instagram: 'https://www.instagram.com/woltektech/',
    email: 'contato@woltek.com.br',
    tagline: 'Transforma lógica em tecnologia escalável.',
    about:
        'Fundei a Woltek, um estúdio de engenharia de software que desenha e constrói sistemas sob medida, apps e sites premium, com código feito à mão e arquitetura pensada para crescer. Atendemos empresas no Brasil inteiro, de forma remota.',
    stats: [
        { value: 35, suffix: '+', label: 'Clientes ativos' },
        { value: 3, suffix: '', label: 'Produtos SaaS em produção' },
        { value: 24, suffix: '/7', label: 'Monitoramento dos sistemas' },
    ],
    services: [
        { title: 'Software sob medida', text: 'Sistemas web, SaaS, CRMs, automações e APIs.' },
        { title: 'Aplicativos', text: 'Apps nativos e multiplataforma para iOS e Android.' },
        { title: 'Sites e landing pages premium', text: 'Presença digital feita para converter.' },
        { title: 'Arquitetura e consultoria', text: 'Decisões técnicas que sustentam o crescimento.' },
    ],
    products: [
        { title: 'CRM multi-tenant', text: 'Funil de vendas, gestão de leads e automação comercial.' },
        { title: 'Gestão Financeira', text: 'Controle de receitas, despesas e relatórios.' },
        { title: 'Plataforma de Apresentações', text: 'Criação e gestão de apresentações comerciais.' },
    ],
    process: [
        { title: 'Imersão', text: 'Entender o negócio, o processo e o problema.' },
        { title: 'Arquitetura', text: 'Desenhar o sistema antes de escrever código.' },
        { title: 'Construção', text: 'Código feito à mão, testado e versionado.' },
        { title: 'Escala', text: 'Deploy, monitoramento e evolução contínua.' },
    ],
};

/* ---------- Atividade no GitHub (instantâneo de out/2026; atualize com o script do README) ---------- */

export type ContributionDay = [string, number];
export const contributionDays = contributions.days as ContributionDay[];
export const contributionTotal = contributions.total;

const longestStreak = () => {
    let run = 0;
    let best = 0;
    contributionDays.forEach(([, count]) => {
        run = count ? run + 1 : 0;
        best = Math.max(best, run);
    });
    return best;
};

export const activityStats = [
    { value: contributionTotal, label: 'Contribuições em 12 meses' },
    { value: contributionDays.filter(([, count]) => count > 0).length, label: 'Dias com código' },
    { value: longestStreak(), label: 'Dias seguidos (recorde)' },
    { value: 66, label: 'Repositórios' },
];

export const facts = [
    { value: contributionTotal, label: 'Contribuições no último ano', icon: 'rocket' },
    { value: 3800, label: 'Commits nos dois maiores sistemas', icon: 'award' },
    { value: 15, label: 'Sistemas e produtos entregues', icon: 'clock' },
    { value: 26, label: 'Certificações', icon: 'coffee' },
] as const;

interface SkillArea {
    name: string;
    text: string;
    uses?: readonly string[];
    category?: string;
    also?: readonly string[];
}

/**
 * Principais áreas, medidas pelo que já foi entregue e não por porcentagem.
 * Os projetos de cada área saem da lista de projetos abaixo (pelo stack); `also` lista onde mais usei.
 */
export const skillAreas = [
    { name: 'TypeScript e Node.js', text: 'APIs, filas e tempo real dos sistemas da operação.', uses: ['TypeScript', 'Node.js'] },
    { name: 'React e Next.js', text: 'Painéis, portais e sites, do Kanban ao checkout.', uses: ['React', 'Next.js'] },
    { name: 'Python e Django', text: 'Backend do SaaS financeiro, automações e scripts.', uses: ['Python', 'Django'], also: ['DOW Chemical', 'Alcoólicos Anônimos'] },
    { name: 'PostgreSQL, Prisma e modelagem', text: 'Modelos multiempresa, migrações e consultas que aguentam produção.', uses: ['PostgreSQL', 'Prisma', 'MySQL'] },
    { name: 'Docker, deploy e observabilidade', text: 'Tudo sobe em contêiner, com métricas e alertas.', uses: ['Docker', 'Coolify', 'Prometheus', 'Grafana'] },
    { name: 'Dados, BI e automação', text: 'Onde comecei: relatórios, indicadores e rotinas automatizadas.', category: 'Finanças e dados', also: ['DOW Chemical', 'Alcoólicos Anônimos'] },
] as const satisfies readonly SkillArea[];

export const stackGroups = [
    { title: 'Frontend', items: ['React 19', 'Next.js 16', 'TypeScript', 'Vite', 'Tailwind', 'TanStack Query', 'Vue 3', 'three.js', 'anime.js'] },
    { title: 'Backend', items: ['Node.js', 'Express', 'Django REST', 'Prisma', 'Socket.io', 'BullMQ', 'Celery', 'REST e webhooks'] },
    { title: 'Dados', items: ['PostgreSQL', 'MySQL', 'Redis', 'pandas', 'Power BI', 'Excel e VBA', 'ETL de planilhas'] },
    { title: 'Infra e DevOps', items: ['Docker', 'Coolify', 'Nginx', 'Prometheus', 'Grafana', 'OpenTelemetry', 'WireGuard', 'GitHub Actions'] },
    { title: 'IA e integrações', items: ['Claude (IA generativa)', 'WhatsApp (Evolution API)', 'OCR', 'Reconhecimento facial', 'Banco Central e IBGE'] },
    { title: 'Sistemas e segurança', items: ['Rust', 'tokio', 'Criptografia ponta a ponta', 'RBAC (Casbin)', '2FA TOTP', 'Vitest e Playwright'] },
];

export const capabilities = [
    { title: 'Produto SaaS de ponta a ponta', text: 'Do banco de dados ao deploy: multiempresa, permissões, cobrança integrada e painel administrativo.' },
    { title: 'Tempo real e IA aplicada', text: 'Chat, funil e notificações ao vivo com Socket.io, e bots que qualificam leads com IA generativa.' },
    { title: 'Finanças e dados', text: 'APIs com dados oficiais, dashboards financeiros, importação inteligente de planilhas e indicadores.' },
    { title: 'Infra que se observa', text: 'Docker, Coolify, métricas no Prometheus, painéis no Grafana e rede privada com WireGuard.' },
];

/* ---------- Projetos ---------- */

export const projectCategories = ['Todos', 'SaaS e sistemas', 'Finanças e dados', 'Educação', 'Infra e ferramentas', 'Sites e lojas'] as const;
export type ProjectCategory = (typeof projectCategories)[number];

export interface Project {
    id: string;
    name: string;
    tagline: string;
    category: Exclude<ProjectCategory, 'Todos'>;
    description: string;
    highlights: string[];
    stack: string[];
    commits?: number;
    status: string;
    accent: string;
    monogram: string;
    link?: { label: string; href: string };
    featured?: boolean;
}

export const projects: Project[] = [
    {
        id: 'crm',
        name: 'Sistema CRM',
        tagline: 'CRM operacional com WhatsApp e IA',
        category: 'SaaS e sistemas',
        description:
            'CRM brasileiro completo: atendimento multicanal pelo WhatsApp, bot SDR com IA generativa, funil de vendas em tempo real, área processual jurídica e reversão de chargeback. É o maior sistema que construí.',
        highlights: [
            'Bot SDR 24/7 com dois motores (regras e IA generativa) que pontua e qualifica leads',
            'Funil Kanban com 7 estágios, arrastar e soltar em tempo real via Socket.io',
            'Vendas com contrato em PDF, reconhecimento facial e portal público para o cliente',
            'Processual com OCR, checklist configurável e relatórios em PDF e DOCX',
            'Reversão de chargeback com coleta progressiva de evidências',
            'Cobrança integrada multiempresa, RBAC com Casbin e 2FA TOTP',
        ],
        stack: ['React', 'TypeScript', 'Node.js', 'Express', 'Prisma', 'PostgreSQL', 'Redis', 'BullMQ', 'Socket.io', 'Docker'],
        commits: 2615,
        status: 'Em produção',
        accent: '#f2c200',
        monogram: 'CRM',
        featured: true,
    },
    {
        id: 'gestao',
        name: 'Sistema de Gestão',
        tagline: 'SaaS financeiro multiempresa',
        category: 'SaaS e sistemas',
        description:
            'Plataforma de gestão financeira para várias empresas: vendas, receitas, despesas, orçamento, fluxo de caixa, relatórios e monitoramento, com processamento em segundo plano e atualizações ao vivo.',
        highlights: [
            'Arquitetura multiempresa com controle centralizado',
            'Fluxo de caixa, orçamento e relatórios gerenciais',
            'Tarefas agendadas com Celery e tempo real com Django Channels',
            'Nginx com cache, limite de requisições e WebSocket',
        ],
        stack: ['Django REST', 'React', 'Vite', 'MySQL', 'Redis', 'Celery', 'Nginx', 'Docker'],
        commits: 1226,
        status: 'Em produção · v2',
        accent: '#5eead4',
        monogram: 'SG',
        featured: true,
    },
    {
        id: 'wertice',
        name: 'Portal Wertice',
        tagline: 'Site institucional e portal de assinaturas',
        category: 'Sites e lojas',
        description:
            'Um repositório, duas faces: o site dos produtos e o portal onde a empresa contrata, assina, paga e gerencia acessos. O portal é a fonte da verdade de cliente, preço, contrato e cobrança.',
        highlights: [
            'Catálogo e planos com preço vindo do próprio portal',
            'Contratação, assinaturas, faturas e checkout',
            'Administração da operação com permissões por perfil',
            'Testes com Vitest e Playwright',
        ],
        stack: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind 4', 'PostgreSQL 17', 'Prisma 7', 'Playwright'],
        commits: 240,
        status: 'Em produção',
        accent: '#a78bfa',
        monogram: 'W',
    },
    {
        id: 'financial-api',
        name: 'API Financeira',
        tagline: 'Taxas oficiais, Tabela Price e simuladores',
        category: 'Finanças e dados',
        description:
            'API financeira independente alimentada pelo Banco Central e pelo IBGE. Toda resposta diz de onde veio o número, qual versão da taxa, qual fórmula e quão atual é o dado.',
        highlights: [
            'Séries históricas versionadas, com a origem de cada número',
            'Motor de cálculo em Decimal: Tabela Price e simuladores',
            'Worker que sincroniza calendário oficial e taxas de 29 modalidades',
            'Documentação OpenAPI e métricas no Prometheus',
        ],
        stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'OpenAPI', 'Prometheus'],
        status: 'Fonte financeira do CRM',
        accent: '#34d399',
        monogram: 'API',
    },
    {
        id: 'import',
        name: 'Import',
        tagline: 'Importação de planilhas e dashboard financeiro',
        category: 'Finanças e dados',
        description:
            'Sobe extratos em XLSX ou CSV, reconhece os cabeçalhos sozinho, evita duplicidade e entrega um dashboard financeiro completo por empresa.',
        highlights: [
            'Parser que entende vários formatos de cabeçalho',
            'Sem duplicatas: identificação por hash da operação e parcela',
            'Chargeback e reapresentação detectados com cálculo do líquido',
            'Dashboard com evolução mensal, ticket médio e top entradas',
        ],
        stack: ['Node.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'React', 'Recharts', 'Docker'],
        commits: 245,
        status: 'Em produção',
        accent: '#60a5fa',
        monogram: 'IM',
    },
    {
        id: 'lms',
        name: 'Órbita e Trilha',
        tagline: 'Plataformas de educação corporativa',
        category: 'Educação',
        description:
            'Dois portais de aprendizagem para empresários, um cliente por instalação, cada um com identidade própria. Cursos, avaliações, certificados e gestão de licenças por uso no mês.',
        highlights: [
            'Cursos com vídeo, áudio, PDF e texto, frequência por tempo de tela',
            'Avaliações com nota ponderada, prazos e certificados',
            'Licenças por usuário ativo no mês com relatório de excedente',
            'Busca global (Ctrl+K), conquistas e anéis de progresso',
        ],
        stack: ['TypeScript', 'React', 'Prisma', 'PostgreSQL', 'Docker', 'Coolify'],
        status: 'Em produção',
        accent: '#22d3ee',
        monogram: 'LMS',
    },
    {
        id: 'elite',
        name: 'Sistema Elite',
        tagline: 'Gestão jurídica que aposentou planilhas',
        category: 'SaaS e sistemas',
        description:
            'Substitui as planilhas de processos, protocolos e laudos de um escritório. Todo lançamento, prazo, alerta e indicador passou a viver no sistema, com permissões e auditoria.',
        highlights: [
            'Central de alertas de audiências e prazos',
            'Classificação automática pelo número CNJ',
            'SLA por tipo de laudo e entregas em lote',
            'Cargos com matriz de permissões e histórico de tudo',
        ],
        stack: ['TypeScript', 'Node.js', 'React', 'Docker'],
        status: 'Em produção',
        accent: '#fb7185',
        monogram: 'EL',
    },
    {
        id: 'woldesk',
        name: 'woldesk',
        tagline: 'Acesso remoto escrito em Rust',
        category: 'Infra e ferramentas',
        description:
            'Aplicativo para ver e controlar a tela de outra máquina, do protocolo binário à criptografia. Conecta entre redes diferentes por um relay que não enxerga o conteúdo.',
        highlights: [
            'Codec de tela por blocos 64×64: só envia o que mudou (delta + zstd)',
            'Canal cifrado ponta a ponta: X25519, Ed25519 e ChaCha20-Poly1305',
            'Relay cego para atravessar NAT',
            'Área de transferência sincronizada',
        ],
        stack: ['Rust', 'tokio', 'zstd', 'Criptografia', 'Windows API'],
        commits: 39,
        status: 'Em desenvolvimento',
        accent: '#f97316',
        monogram: 'WD',
    },
    {
        id: 'woltek-ci',
        name: 'Woltek CI',
        tagline: 'GitHub Actions rodando na sua máquina',
        category: 'Infra e ferramentas',
        description:
            'Roda os workflows do GitHub Actions localmente em containers, sem gastar minutos: painel ao vivo, status no GitHub, fila com pausa e previsão de término.',
        highlights: [
            'Fila com pausa que congela a rodada e retoma de onde parou',
            'Modo urgente que passa na frente e devolve a vez',
            'Previsão de término realista no app e no terminal',
            'Instalador versionado com notas de cada versão',
        ],
        stack: ['JavaScript', 'Docker', 'PowerShell', 'Inno Setup'],
        status: 'v1.5.0',
        accent: '#facc15',
        monogram: 'CI',
        link: { label: 'Ver versões', href: 'https://github.com/Duniinjja/woltek-ci-releases' },
    },
    {
        id: 'observability',
        name: 'Observabilidade VTX',
        tagline: 'Métricas e painéis do CRM em produção',
        category: 'Infra e ferramentas',
        description:
            'Prometheus e Grafana numa máquina central, agentes no servidor do CRM e tudo ligado por WireGuard. Nada de observabilidade fica aberto na internet.',
        highlights: [
            'Coletor OpenTelemetry, cAdvisor e exportadores de Postgres e Redis',
            'Painéis do Grafana gerados e validados por scripts Python',
            'Deploy pelo Coolify a partir do repositório',
        ],
        stack: ['Prometheus', 'Grafana', 'OpenTelemetry', 'WireGuard', 'Docker', 'Python'],
        status: 'Em produção',
        accent: '#e879f9',
        monogram: 'OBS',
    },
    {
        id: 'newdesign',
        name: 'New Design',
        tagline: 'Loja online de brindes personalizados',
        category: 'Sites e lojas',
        description:
            'Loja completa: vitrine, personalização de produto, carrinho, checkout com pagamento, kits de brinde, orçamento para empresas e um painel pensado para quem não é de tecnologia.',
        highlights: [
            'Personalização de produto direto na vitrine',
            'Kits de brinde e orçamento para empresas',
            'Painel administrativo simples para o lojista',
        ],
        stack: ['Next.js', 'TypeScript', 'Prisma', 'Docker'],
        commits: 100,
        status: 'Pronto para publicar',
        accent: '#4ade80',
        monogram: 'ND',
    },
    {
        id: 'barber',
        name: 'Desenove Barber',
        tagline: 'Sistema para barbearia',
        category: 'SaaS e sistemas',
        description: 'Sistema de barbearia com agenda e atendimento, pensado primeiro para o celular de quem trabalha no balcão.',
        highlights: ['Agenda do dia e da semana', 'Atendimento com conversa integrada', 'Painel responsivo de verdade no celular'],
        stack: ['TypeScript', 'React', 'PostgreSQL', 'Docker'],
        commits: 39,
        status: 'Em desenvolvimento',
        accent: '#fbbf24',
        monogram: '19',
    },
    {
        id: 'profile',
        name: 'Perfil GitHub animado',
        tagline: 'Heatmap ao vivo, retrato ASCII e card neofetch',
        category: 'Infra e ferramentas',
        description:
            'Meu perfil do GitHub é gerado por scripts Python: SVGs animados, sem serviço de terceiros e sem JavaScript, atualizados todo dia pelo GitHub Actions.',
        highlights: ['SVG animado gerado por código', 'Atualização diária automática', 'Zero dependência externa'],
        stack: ['Python', 'SVG', 'GitHub Actions'],
        commits: 41,
        status: 'Público',
        accent: '#94a3b8',
        monogram: '>_',
        link: { label: 'Ver no GitHub', href: 'https://github.com/Duniinjja/Duniinjja' },
    },
];

/** Onde tudo começou: os primeiros projetos públicos, em Python. */
export const earlyProjects = [
    { name: 'AI.Chatbot', text: 'Categorização de gastos em linguagem natural.', image: project1, href: 'https://github.com/Duniinjja/chatbot-01' },
    { name: 'Verificador de categoria', text: 'Validação de receitas e despesas contra o de/para.', image: project2, href: 'https://github.com/Duniinjja/Verificador-de-categoria' },
    { name: 'Analista de categoria', text: 'A versão desktop: sobe a planilha e confere tudo.', image: project3, href: 'https://github.com/Duniinjja/Analista-de-categoria---Desktop' },
];
