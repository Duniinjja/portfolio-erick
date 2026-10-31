// Atualiza src/data/contributions.json com o calendário de contribuições do GitHub.
// Uso: GH_TOKEN=<token> node scripts/update-contributions.mjs
// O token precisa ser seu (não o GITHUB_TOKEN do Actions) para incluir as contribuições privadas.
import { readFileSync, writeFileSync } from 'node:fs';

const token = process.env.GH_TOKEN;
if (!token) {
    console.error('Defina GH_TOKEN com um token pessoal do GitHub.');
    process.exit(1);
}

const query = `{ viewer { contributionsCollection { contributionCalendar {
    totalContributions weeks { contributionDays { date contributionCount } }
} } } }`;

const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
});
const payload = await response.json();
const calendar = payload?.data?.viewer?.contributionsCollection?.contributionCalendar;
if (!response.ok || !calendar) {
    console.error('Resposta inesperada do GitHub:', JSON.stringify(payload).slice(0, 500));
    process.exit(1);
}

const data = {
    total: calendar.totalContributions,
    days: calendar.weeks.flatMap((week) => week.contributionDays.map((day) => [day.date, day.contributionCount])),
};

const path = new URL('../src/data/contributions.json', import.meta.url);
const next = JSON.stringify(data);
const current = readFileSync(path, 'utf8').trim();
if (current === next) {
    console.log(`Sem mudanças (${data.total} contribuições).`);
} else {
    writeFileSync(path, next);
    console.log(`Atualizado: ${data.total} contribuições em ${data.days.length} dias.`);
}
