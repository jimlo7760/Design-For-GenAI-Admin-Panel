// The Week 7 sections, described once. Each entry says which table or view it reads, which of
// create / update / delete it offers, how its list and detail pages look and what its form asks for.
// The generic pages under app/(admin)/[resource]/ do the rest, so adding a section is adding an entry.
//
// "ops" here is only what the interface offers. What is actually allowed is decided by the database
// (supabase/week7.sql), which grants exactly the same verbs and nothing more.
//
// Column and field `type`s:
//   columns  title (link to the detail page) · text · long (cut short in lists) · int · bool · date
//            pill · link (needs href) · share (a bar: this row's weight over the total) · response
//   fields   text · textarea · int · bool · select · url · domain · email   (see lib/records.js)

const first = (value) => (Array.isArray(value) ? value[0] : value);
const count = (embedded) => first(embedded)?.count ?? 0;
const ALL = { create: true, update: true, delete: true };
const READ = { create: false, update: false, delete: false };

const newest = { label: 'Newest', order: [['created_at', false]] };
const oldest = { label: 'Oldest', order: [['created_at', true]] };
const az = (column, label = 'A to Z') => ({ label, order: [[column, true]] });
const edited = { label: 'Recently edited', order: [['updated_at', false]] };

const list = [
    // -- Prompts ---------------------------------------------------------------------------------
    {
        key: 'prompt-chains',
        table: 'prompt_chains',
        title: 'Prompt chains',
        noun: 'prompt chain',
        nouns: 'prompt chains',
        blurb: 'The chains of prompts that build something. Open one to see its steps and how much traffic it gets.',
        readOnlyNote: 'Chains are read-only here. They are created in the Supabase SQL editor, which also keeps their mix row.',
        ops: READ,
        select: '*, prompt_chain_steps(count), prompt_chain_mix(weight)',
        search: ['name', 'description'],
        sorts: { name: az('name'), new: newest, old: oldest },
        defaultSort: 'name',
        heading: (row) => row.name,
        columns: [
            { key: 'name', label: 'Chain', type: 'title' },
            { key: 'description', label: 'What it does', type: 'long' },
            { key: 'is_active', label: 'Status', type: 'bool', labels: ['Active', 'Off'] },
            { key: 'steps', label: 'Steps', type: 'link', align: 'r', get: (row) => count(row.prompt_chain_steps), href: (row) => `/prompt-chain-steps?chain=${row.id}` },
            { key: 'weight', label: 'Mix weight', type: 'link', align: 'r', get: (row) => first(row.prompt_chain_mix)?.weight ?? 0, href: () => '/prompt-chain-mix' },
            { key: 'created_at', label: 'Added', type: 'date' },
        ],
        details: [
            { key: 'is_active', label: 'Status', type: 'bool', labels: ['Active', 'Off'] },
            { key: 'weight', label: 'Mix weight', type: 'link', get: (row) => first(row.prompt_chain_mix)?.weight ?? 0, href: () => '/prompt-chain-mix' },
            { key: 'description', label: 'What it does', type: 'long' },
        ],
        related: [{ resource: 'prompt-chain-steps', column: 'chain_id', title: 'Steps', limit: 50 }, { resource: 'generation-examples', column: 'chain_id', title: 'Examples', limit: 10 }],
    },
    {
        key: 'prompt-chain-steps',
        table: 'prompt_chain_steps',
        title: 'Chain steps',
        noun: 'prompt chain step',
        nouns: 'prompt chain steps',
        blurb: 'Every step of every chain, in order: which model runs it and what it is told.',
        readOnlyNote: 'Steps are read-only here. Edit them in the Supabase SQL editor.',
        ops: READ,
        select: '*, prompt_chains(name), llm_models(name)',
        search: ['name', 'system_prompt', 'user_prompt'],
        sorts: { order: { label: 'By chain, then step', order: [['chain_id', true], ['step_order', true]] }, new: newest },
        defaultSort: 'order',
        scopes: { chain: { column: 'chain_id', from: 'prompt-chains', label: 'chain' }, model: { column: 'llm_model_id', from: 'llm-models', label: 'model' } },
        heading: (row) => `${first(row.prompt_chains)?.name ?? 'Chain'}, step ${row.step_order}: ${row.name}`,
        columns: [
            { key: 'step_order', label: 'Step', type: 'int', align: 'r' },
            { key: 'name', label: 'Name', type: 'title' },
            { key: 'chain', label: 'Chain', type: 'link', get: (row) => first(row.prompt_chains)?.name, href: (row) => `/prompt-chains/${row.chain_id}` },
            { key: 'model', label: 'Model', type: 'link', get: (row) => first(row.llm_models)?.name, href: (row) => (row.llm_model_id ? `/llm-models/${row.llm_model_id}` : null) },
            { key: 'system_prompt', label: 'Instruction', type: 'long' },
        ],
        details: [
            { key: 'chain', label: 'Chain', type: 'link', get: (row) => first(row.prompt_chains)?.name, href: (row) => `/prompt-chains/${row.chain_id}` },
            { key: 'step_order', label: 'Step number', type: 'int' },
            { key: 'model', label: 'Model', type: 'link', get: (row) => first(row.llm_models)?.name, href: (row) => (row.llm_model_id ? `/llm-models/${row.llm_model_id}` : null) },
            { key: 'system_prompt', label: 'System prompt', type: 'long' },
            { key: 'user_prompt', label: 'User prompt', type: 'long' },
        ],
    },
    {
        key: 'prompt-chain-mix',
        table: 'prompt_chain_mix',
        title: 'Chain mix',
        noun: 'chain mix',
        nouns: 'chain mixes',
        blurb: 'How requests are shared out between chains. Weights are relative: chains weighted 3 and 1 get 75% and 25%.',
        ops: { create: false, update: true, delete: false },
        select: '*, prompt_chains(name, is_active)',
        search: [],
        totals: 'weight',
        sorts: { weight: { label: 'Biggest share', order: [['weight', false]] }, edited },
        defaultSort: 'weight',
        heading: (row) => `Mix for ${first(row.prompt_chains)?.name ?? 'a chain'}`,
        columns: [
            { key: 'chain', label: 'Chain', type: 'title', get: (row) => first(row.prompt_chains)?.name },
            { key: 'weight', label: 'Weight', type: 'int', align: 'r' },
            { key: 'share', label: 'Share of requests', type: 'share', get: (row, ctx) => (ctx.totals?.weight > 0 ? row.weight / ctx.totals.weight : 0) },
            { key: 'active', label: 'Chain status', type: 'bool', labels: ['Active', 'Off'], get: (row) => first(row.prompt_chains)?.is_active },
            { key: 'updated_at', label: 'Changed', type: 'date' },
        ],
        details: [
            { key: 'chain', label: 'Chain', type: 'link', get: (row) => first(row.prompt_chains)?.name, href: (row) => `/prompt-chains/${row.chain_id}` },
            { key: 'weight', label: 'Weight', type: 'int' },
            { key: 'share', label: 'Share of requests', type: 'share', get: (row, ctx) => (ctx.totals?.weight > 0 ? row.weight / ctx.totals.weight : 0) },
        ],
        fields: [
            { name: 'weight', label: 'Weight', type: 'int', required: true, min: 0, maxValue: 1000, hint: 'A whole number from 0 to 1000. 0 means this chain gets no requests. Only the weight can be changed here.' },
        ],
    },
    {
        key: 'generation-examples',
        table: 'generation_examples',
        title: 'Examples',
        noun: 'generation example',
        nouns: 'generation examples',
        blurb: 'Examples of what the AI is given and what a good answer looks like.',
        ops: ALL,
        select: '*, prompt_chains(name)',
        search: ['title', 'input_prompt', 'expected_output'],
        sorts: { new: newest, title: az('title'), edited },
        defaultSort: 'new',
        scopes: { chain: { column: 'chain_id', from: 'prompt-chains', label: 'chain' } },
        heading: (row) => row.title,
        columns: [
            { key: 'title', label: 'Example', type: 'title' },
            { key: 'chain', label: 'Chain', type: 'link', get: (row) => first(row.prompt_chains)?.name, href: (row) => (row.chain_id ? `/prompt-chains/${row.chain_id}` : null) },
            { key: 'input_prompt', label: 'Input', type: 'long' },
            { key: 'expected_output', label: 'Expected output', type: 'long' },
            { key: 'updated_at', label: 'Edited', type: 'date' },
        ],
        details: [
            { key: 'chain', label: 'Chain', type: 'link', get: (row) => first(row.prompt_chains)?.name, href: (row) => (row.chain_id ? `/prompt-chains/${row.chain_id}` : null) },
            { key: 'input_prompt', label: 'Input', type: 'long' },
            { key: 'expected_output', label: 'Expected output', type: 'long' },
        ],
        fields: [
            { name: 'title', label: 'Title', type: 'text', required: true, max: 120, hint: 'A short name so you can find it again.' },
            { name: 'chain_id', label: 'Prompt chain', type: 'select', optionsFrom: 'prompt-chains', blank: 'Not tied to a chain', hint: 'Optional. The chain this example is for.' },
            { name: 'input_prompt', label: 'Input', type: 'textarea', required: true, max: 4000, rows: 5, hint: 'What the AI is given.' },
            { name: 'expected_output', label: 'Expected output', type: 'textarea', required: true, max: 8000, rows: 8, hint: 'What a good answer looks like.' },
        ],
    },
    {
        key: 'generation-requests',
        table: 'generation_requests',
        title: 'Requests',
        noun: 'generation request',
        nouns: 'generation requests',
        blurb: 'Every time someone asked the AI to design a build: who, what they asked for and which model answered.',
        readOnlyNote: 'This is a live view of the builds Mod Squad has made, so it is read-only. A request that failed before a build was saved leaves nothing to show here.',
        ops: READ,
        select: '*',
        search: ['build_title', 'car_name', 'vibe', 'prompt', 'model_name', 'user_name'],
        sorts: { new: newest, old: oldest },
        defaultSort: 'new',
        scopes: { user: { column: 'user_id', from: 'users', label: 'person' } },
        heading: (row) => row.build_title,
        columns: [
            { key: 'build_title', label: 'Request', type: 'title' },
            { key: 'user', label: 'Asked by', type: 'user', get: (row) => ({ id: row.user_id, first_name: row.user_name, avatar_url: row.avatar_url }) },
            { key: 'prompt', label: 'Prompt', type: 'long' },
            { key: 'model_name', label: 'Model', type: 'pill' },
            { key: 'has_render', label: 'Render', type: 'bool', labels: ['Yes', 'No'] },
            { key: 'created_at', label: 'Asked', type: 'date' },
        ],
        details: [
            { key: 'build', label: 'Build it made', type: 'link', get: (row) => row.build_title, href: (row) => `/media/${row.build_id}` },
            { key: 'user', label: 'Asked by', type: 'user', get: (row) => ({ id: row.user_id, first_name: row.user_name, avatar_url: row.avatar_url }) },
            { key: 'car_name', label: 'Car' },
            { key: 'vibe', label: 'Vibe' },
            { key: 'model_name', label: 'Model', type: 'pill' },
            { key: 'has_render', label: 'Render', type: 'bool', labels: ['Yes', 'No'] },
            { key: 'prompt', label: 'Prompt', type: 'long' },
        ],
        related: [{ resource: 'llm-responses', column: 'request_id', title: 'What the models answered', limit: 10 }],
    },
    {
        key: 'llm-responses',
        table: 'llm_responses',
        title: 'Responses',
        noun: 'LLM response',
        nouns: 'LLM responses',
        blurb: 'What the models gave back: the text that designed each build and the image that drew it.',
        readOnlyNote: 'This is a live view of the builds Mod Squad has made, so it is read-only. Renders uploaded by an admin are not model output and are left out.',
        ops: READ,
        select: '*',
        search: ['build_title', 'model_name', 'response'],
        sorts: { new: newest, old: oldest },
        defaultSort: 'new',
        scopes: { model: { column: 'model_id', from: 'llm-models', label: 'model' }, request: { column: 'request_id', from: 'generation-requests', label: 'request' } },
        heading: (row) => `${row.kind === 'image' ? 'Image' : 'Text'} for ${row.build_title}`,
        columns: [
            { key: 'build_title', label: 'For build', type: 'title' },
            { key: 'kind', label: 'Kind', type: 'pill' },
            { key: 'model', label: 'Model', type: 'link', get: (row) => row.model_name, href: (row) => (row.model_id ? `/llm-models/${row.model_id}` : null) },
            { key: 'response', label: 'Response', type: 'response' },
            { key: 'created_at', label: 'Answered', type: 'date' },
        ],
        details: [
            { key: 'build', label: 'Build', type: 'link', get: (row) => row.build_title, href: (row) => `/media/${row.request_id}` },
            { key: 'request', label: 'Request', type: 'link', get: () => 'See the request', href: (row) => `/generation-requests/${row.request_id}` },
            { key: 'kind', label: 'Kind', type: 'pill' },
            { key: 'model', label: 'Model', type: 'link', get: (row) => row.model_name, href: (row) => (row.model_id ? `/llm-models/${row.model_id}` : null) },
            { key: 'prompt', label: 'Prompt', type: 'long' },
            { key: 'response', label: 'Response', type: 'response' },
        ],
    },

    // -- Models ----------------------------------------------------------------------------------
    {
        key: 'llm-models',
        table: 'llm_models',
        title: 'Models',
        noun: 'model',
        nouns: 'models',
        blurb: 'The AI models Mod Squad can use. Names should match what Mod Squad records on a build, so responses can be linked back to them.',
        ops: ALL,
        select: '*, llm_providers(name)',
        search: ['name', 'notes'],
        sorts: { name: az('name'), new: newest, edited },
        defaultSort: 'name',
        scopes: { provider: { column: 'provider_id', from: 'llm-providers', label: 'provider' } },
        heading: (row) => row.name,
        unique: { field: 'name', message: 'A model with that name already exists.' },
        columns: [
            { key: 'name', label: 'Model', type: 'title' },
            { key: 'provider', label: 'Provider', type: 'link', get: (row) => first(row.llm_providers)?.name, href: (row) => (row.provider_id ? `/llm-providers/${row.provider_id}` : null) },
            { key: 'kind', label: 'Kind', type: 'pill' },
            { key: 'is_active', label: 'Status', type: 'bool', labels: ['Active', 'Off'] },
            { key: 'notes', label: 'Notes', type: 'long' },
            { key: 'updated_at', label: 'Edited', type: 'date' },
        ],
        details: [
            { key: 'provider', label: 'Provider', type: 'link', get: (row) => first(row.llm_providers)?.name, href: (row) => (row.provider_id ? `/llm-providers/${row.provider_id}` : null) },
            { key: 'kind', label: 'Kind', type: 'pill' },
            { key: 'is_active', label: 'Status', type: 'bool', labels: ['Active', 'Off'] },
            { key: 'notes', label: 'Notes', type: 'long' },
        ],
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true, max: 120, hint: 'As Mod Squad records it on a build, for example “gemini-2.5-flash”.' },
            { name: 'provider_id', label: 'Provider', type: 'select', optionsFrom: 'llm-providers', blank: 'No provider yet' },
            { name: 'kind', label: 'Kind', type: 'select', required: true, choices: [['text', 'Text (writes the build)'], ['image', 'Image (draws the render)']] },
            { name: 'is_active', label: 'In use', type: 'bool', hint: 'Untick to keep the record but mark the model as switched off.' },
            { name: 'notes', label: 'Notes', type: 'textarea', max: 1000, rows: 3 },
        ],
        defaults: { kind: 'text', is_active: true },
        related: [{ resource: 'llm-responses', column: 'model_id', title: 'Recent responses', limit: 10 }],
    },
    {
        key: 'llm-providers',
        table: 'llm_providers',
        title: 'Providers',
        noun: 'provider',
        nouns: 'providers',
        blurb: 'The companies that run the models.',
        ops: ALL,
        select: '*, llm_models(count)',
        search: ['name', 'base_url', 'notes'],
        sorts: { name: az('name'), new: newest, edited },
        defaultSort: 'name',
        heading: (row) => row.name,
        unique: { field: 'name', message: 'A provider with that name already exists.' },
        columns: [
            { key: 'name', label: 'Provider', type: 'title' },
            { key: 'base_url', label: 'Web address', type: 'text' },
            { key: 'models', label: 'Models', type: 'link', align: 'r', get: (row) => count(row.llm_models), href: (row) => `/llm-models?provider=${row.id}` },
            { key: 'notes', label: 'Notes', type: 'long' },
            { key: 'updated_at', label: 'Edited', type: 'date' },
        ],
        details: [
            { key: 'base_url', label: 'Web address', type: 'text' },
            { key: 'models', label: 'Models', type: 'link', get: (row) => count(row.llm_models), href: (row) => `/llm-models?provider=${row.id}` },
            { key: 'notes', label: 'Notes', type: 'long' },
        ],
        fields: [
            { name: 'name', label: 'Name', type: 'text', required: true, max: 80, hint: 'For example “Google” or “OpenAI”.' },
            { name: 'base_url', label: 'Web address', type: 'url', max: 300, hint: 'Optional. The provider’s API address, starting with https://.' },
            { name: 'notes', label: 'Notes', type: 'textarea', max: 1000, rows: 3 },
        ],
        related: [{ resource: 'llm-models', column: 'provider_id', title: 'Models', limit: 50 }],
        deleteNote: 'A provider that still has models cannot be deleted. Move or delete its models first.',
    },

    // -- Content ---------------------------------------------------------------------------------
    {
        key: 'terms',
        table: 'terms',
        title: 'Terms',
        noun: 'term',
        nouns: 'terms',
        blurb: 'The vocabulary of Mod Squad: each word with a definition and an example.',
        ops: ALL,
        select: '*',
        search: ['term', 'definition', 'example'],
        sorts: { term: az('term'), new: newest, edited },
        defaultSort: 'term',
        heading: (row) => row.term,
        unique: { field: 'term', message: 'That term already exists. Capital letters do not make it different.' },
        columns: [
            { key: 'term', label: 'Term', type: 'title' },
            { key: 'definition', label: 'Definition', type: 'long' },
            { key: 'example', label: 'Example', type: 'long' },
            { key: 'updated_at', label: 'Edited', type: 'date' },
        ],
        details: [
            { key: 'definition', label: 'Definition', type: 'long' },
            { key: 'example', label: 'Example', type: 'long' },
        ],
        fields: [
            { name: 'term', label: 'Term', type: 'text', required: true, max: 80 },
            { name: 'definition', label: 'Definition', type: 'textarea', required: true, max: 2000, rows: 4 },
            { name: 'example', label: 'Example', type: 'textarea', max: 1000, rows: 3, hint: 'Optional. The word used in a sentence.' },
        ],
    },

    // -- Access ----------------------------------------------------------------------------------
    {
        key: 'allowed-signup-domains',
        table: 'allowed_signup_domains',
        title: 'Signup domains',
        noun: 'signup domain',
        nouns: 'signup domains',
        blurb: 'Email domains whose owners may sign up, for example columbia.edu.',
        ops: ALL,
        select: '*',
        search: ['domain', 'note'],
        sorts: { domain: az('domain'), new: newest },
        defaultSort: 'domain',
        heading: (row) => row.domain,
        unique: { field: 'domain', message: 'That domain is already on the list.' },
        columns: [
            { key: 'domain', label: 'Domain', type: 'title' },
            { key: 'note', label: 'Note', type: 'long' },
            { key: 'created_at', label: 'Added', type: 'date' },
        ],
        details: [{ key: 'note', label: 'Note', type: 'long' }],
        fields: [
            { name: 'domain', label: 'Domain', type: 'domain', required: true, hint: 'Just the part after the @, like columbia.edu. Saved in lower case.' },
            { name: 'note', label: 'Note', type: 'text', max: 200, hint: 'Optional. Why this domain is allowed.' },
        ],
    },
    {
        key: 'whitelisted-emails',
        table: 'whitelisted_emails',
        title: 'Whitelisted emails',
        noun: 'whitelisted email',
        nouns: 'whitelisted emails',
        blurb: 'Individual email addresses that may sign up even if their domain is not on the list.',
        ops: ALL,
        select: '*',
        search: ['email', 'note'],
        sorts: { email: az('email'), new: newest },
        defaultSort: 'email',
        heading: (row) => row.email,
        unique: { field: 'email', message: 'That address is already on the list.' },
        columns: [
            { key: 'email', label: 'Email', type: 'title' },
            { key: 'note', label: 'Note', type: 'long' },
            { key: 'created_at', label: 'Added', type: 'date' },
        ],
        details: [{ key: 'note', label: 'Note', type: 'long' }],
        fields: [
            { name: 'email', label: 'Email address', type: 'email', required: true, hint: 'Saved in lower case.' },
            { name: 'note', label: 'Note', type: 'text', max: 200, hint: 'Optional. Who this is.' },
        ],
    },
];

export const RESOURCE_LIST = list;
export const RESOURCES = Object.fromEntries(list.map((resource) => [resource.key, resource]));

// Looks up a section by the URL segment. Own properties only, so /constructor or /__proto__ is a
// plain "not found" rather than something inherited from Object.
export const resourceFor = (key) => (typeof key === 'string' && Object.hasOwn(RESOURCES, key) ? RESOURCES[key] : null);

// Where a record's own pages live.
export const recordHref = (resource, id) => `/${resource.key}/${id}`;
