interface IExperienceList {
    companyName: string;
    companyImage: string;
    startAt: string;
    endAt: string;
    locale: string;
    position: string;
    description: string;
    highlights?: string[];
}

const experienceList: Array<IExperienceList> = [
    {
        companyImage: 'dow.png',
        companyName: 'DOW Chemical',
        startAt: '01/07/2019',
        endAt: '12/02/2020',
        locale: 'São Paulo/SP',
        position: 'Business Analyst',
        description: 'Atuação na área financeira com análise de dados, controle de gastos, faturamento em XML e organização fiscal, utilizando Egestor. Experiência em e-commerce, relatórios gerenciais e automação de rotinas financeiras com Python.'
    },
    {
        companyImage: 'AA.png',
        companyName: 'Alcoólicos Anônimos',
        startAt: '22/09/2021',
        endAt: '01/06/2024',
        locale: 'São Paulo/SP',
        position: 'Data Analyst',
        description: 'Controle de documentos, otimização de processos e elaboração de relatórios e gráficos analíticos para apoio à tomada de decisões, utilizando Power BI, Excel, VBA e Python.'
    },
    {
        companyImage: 'grupouop.jpg',
        companyName: 'Grupo UOP',
        startAt: '06/10/2025',
        endAt: 'Atual',
        locale: 'São Paulo/SP',
        position: 'Analista de Dados e Desenvolvedor Full Stack',
        description: 'Entrei como analista de dados e passei a construir os sistemas da operação de ponta a ponta: do banco de dados ao deploy, com observabilidade em produção.',
        highlights: [
            'CRM com WhatsApp, IA generativa e funil em tempo real (2.600+ commits)',
            'SaaS financeiro multiempresa em Django e React (1.200+ commits)',
            'API financeira com dados do Banco Central e do IBGE',
            'Importação de extratos e dashboards financeiros',
            'Prometheus, Grafana e WireGuard para monitorar a produção',
        ],
    },
];

export { experienceList }; export type { IExperienceList };
