// ----- Data + storage helpers -----

const STORAGE_KEY_RECIPES = 'familyRecipesData_v1';
const STORAGE_KEY_FAVS = 'familyRecipeFavourites_v1';

// Basic starter recipes
const defaultRecipes = [
  {
    id: 'nanas-roast',
    name: "Nana's Sunday Roast",
    category: 'Dinner',
    cookTime: '2 hours',
    servings: 4,
    tags: ['family classic', 'comfort'],
    ingredients: [
      '1.5kg beef joint',
      '6 potatoes',
      '3 carrots',
      '2 parsnips',
      '1 onion',
      'Gravy granules',
      'Salt & pepper',
      'Olive oil'
    ],
    steps: [
      'Preheat oven to 180°C (fan).',
      'Season beef with salt, pepper and olive oil.',
      'Roast beef for about 1 hour 30 minutes (adjust for size/doneness).',
      'Parboil potatoes 10 minutes, rough edges, toss in oil.',
      'Add potatoes and chopped veg for final 45–60 minutes.',
      'Rest beef for at least 15 minutes before carving.',
      'Make gravy from meat juices and gravy granules.'
    ],
    notes: 'Nana: “Let the meat rest or it cries on the plate.”'
  },
  {
    id: 'choc-brownies',
    name: 'Gooey Chocolate Brownies',
    category: 'Dessert',
    cookTime: '35 minutes',
    servings: 12,
    tags: ['chocolate', 'baking'],
    ingredients: [
      '200g dark chocolate',
      '175g butter',
      '3 large eggs',
      '250g caster sugar',
      '100g plain flour',
      '30g cocoa powder',
      'Pinch of salt'
    ],
    steps: [
      'Preheat oven to 180°C (160°C fan). Line a square tin.',
      'Melt chocolate and butter, leave to cool slightly.',
      'Whisk eggs and sugar until thick and pale.',
      'Fold chocolate mixture into eggs gently.',
      'Sift in flour, cocoa and salt. Fold until just combined.',
      'Bake 20–25 minutes until just set in the middle.',
      'Cool completely before slicing.'
    ],
    notes: 'Add nuts or extra chocolate if you like.'
  },
  {
    id: 'overnight-oats',
    name: 'Overnight Oats',
    category: 'Breakfast',
    cookTime: '10 minutes prep + overnight',
    servings: 1,
    tags: ['healthy', 'quick'],
    ingredients: [
      '50g rolled oats',
      '150ml milk (or dairy-free)',
      '1 tbsp yoghurt',
      '1 tsp honey or maple syrup',
      'Fresh fruit to top'
    ],
    steps: [
      'Combine oats, milk, yoghurt and honey in a jar.',
      'Stir well, cover, and chill overnight.',
      'Top with fruit, nuts or seeds in the morning.'
    ],
    notes: 'Scale up easily for multiple portions.'
  }
];

function loadRecipes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECIPES);
    if (!stored) return [...defaultRecipes];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...defaultRecipes];
    }
    return parsed;
  } catch {
    return [...defaultRecipes];
  }
}

function saveRecipes(recipes) {
  localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify(recipes));
}

function loadFavourites() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FAVS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavourites(favs) {
  localStorage.setItem(STORAGE_KEY_FAVS, JSON.stringify(favs));
}

let recipes = loadRecipes();
let favourites = loadFavourites();
let currentRecipeId = recipes[0]?.id || null;
let activeCategory = '';
let showFavouritesOnly = false;

// For cook mode (per session)
let cookMode = {
  enabled: false,
  currentStepIndex: 0
};

// ----- DOM references -----

const recipeListEl = document.getElementById('recipeList');
const recipeDetailEl = document.getElementById('recipeDetail');
const searchInputEl = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoryChipsEl = document.getElementById('categoryChips');
const favouritesToggleEl = document.getElementById('favouritesToggle');
const resultCountEl = document.getElementById('resultCount');
const randomRecipeBtn = document.getElementById('randomRecipeBtn');
const addRecipeBtn = document.getElementById('addRecipeBtn');

// Modals
const recipeModalBackdrop = document.getElementById('recipeModalBackdrop');
const recipeModalTitle = document.getElementById('recipeModalTitle');
const closeRecipeModalBtn = document.getElementById('closeRecipeModalBtn');
const cancelRecipeBtn = document.getElementById('cancelRecipeBtn');
const recipeForm = document.getElementById('recipeForm');
const recipeNameInput = document.getElementById('recipeName');
const recipeCategorySelect = document.getElementById('recipeCategory');
const recipeCookTimeInput = document.getElementById('recipeCookTime');
const recipeServingsInput = document.getElementById('recipeServings');
const recipeTagsInput = document.getElementById('recipeTags');
const recipeIngredientsTextarea = document.getElementById('recipeIngredients');
const recipeStepsTextarea = document.getElementById('recipeSteps');
const recipeNotesTextarea = document.getElementById('recipeNotes');
const recipeIdHidden = document.getElementById('recipeId');

// Delete modal
const confirmDeleteBackdrop = document.getElementById('confirmDeleteBackdrop');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let recipeIdToDelete = null;

// ----- Utility -----

function generateId(name) {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') +
    '-' +
    Date.now().toString(36)
  );
}

function isFavourite(id) {
  return favourites.includes(id);
}

function toggleFavourite(id) {
  if (isFavourite(id)) {
    favourites = favourites.filter(f => f !== id);
  } else {
    favourites.push(id);
  }
  saveFavourites(favourites);
  renderRecipeList();
  if (currentRecipeId === id) {
    renderRecipeDetail();
  }
}

// ----- Filtering + search -----

function getFilteredRecipes() {
  const term = searchInputEl.value.trim().toLowerCase();
  return recipes.filter(r => {
    if (activeCategory && r.category !== activeCategory) return false;
    if (showFavouritesOnly && !isFavourite(r.id)) return false;

    if (!term) return true;

    const inName = r.name.toLowerCase().includes(term);
    const inTags = (r.tags || []).some(tag =>
      tag.toLowerCase().includes(term)
    );
    const inIngredients = r.ingredients.some(ing =>
      ing.toLowerCase().includes(term)
    );

    return inName || inTags || inIngredients;
  });
}

// ----- Rendering list -----

function renderRecipeList() {
  const filtered = getFilteredRecipes();
  recipeListEl.innerHTML = '';

  resultCountEl.textContent =
    filtered.length === 1 ? '1 recipe' : `${filtered.length} recipes`;

  if (filtered.length === 0) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent =
      'No recipes match your search or filters. Try changing them or add a new recipe.';
    recipeListEl.appendChild(p);
    return;
  }

  filtered.forEach(r => {
    const item = document.createElement('div');
    item.className = 'recipe-item';
    if (r.id === currentRecipeId) item.classList.add('active');

    const main = document.createElement('div');
    main.className = 'recipe-item-main';

    const title = document.createElement('h3');
    title.textContent = r.name;

    const meta = document.createElement('small');
    const favStar = isFavourite(r.id) ? '⭐ ' : '';
    meta.textContent = `${favStar}${r.category} • ${r.cookTime || 'Time n/a'} • Serves ${r.servings || '?'}`;

    main.appendChild(title);
    main.appendChild(meta);

    const badge = document.createElement('span');
    badge.className = 'recipe-badge';
    badge.textContent = (r.tags && r.tags[0]) ? r.tags[0] : '';

    item.appendChild(main);
    if (badge.textContent) item.appendChild(badge);

    item.addEventListener('click', () => {
      currentRecipeId = r.id;
      cookMode.enabled = false;
      cookMode.currentStepIndex = 0;
      renderRecipeList();
      renderRecipeDetail();
    });

    recipeListEl.appendChild(item);
  });
}

// ----- Rendering detail -----

function renderRecipeDetail() {
  const recipe = recipes.find(r => r.id === currentRecipeId);
  if (!recipe) {
    recipeDetailEl.innerHTML = '<p class="placeholder">No recipe selected.</p>';
    return;
  }

  const favActiveClass = isFavourite(recipe.id) ? 'active' : '';
  const favLabel = isFavourite(recipe.id)
    ? '⭐ Favourite'
    : '☆ Mark as favourite';

  const tagsHtml = (recipe.tags || [])
    .map(tag => `<span class="tag">${tag}</span>`)
    .join('');

  // Ingredients HTML with checkboxes
  const ingredientsHtml = recipe.ingredients
    .map(
      (ing, idx) => `
      <li>
        <label class="checkable-line">
          <input type="checkbox" data-ingredient-index="${idx}">
          <span>${ing}</span>
        </label>
      </li>
    `
    )
    .join('');

  // Steps HTML with checkboxes
  const stepsHtml = recipe.steps
    .map(
      (step, idx) => `
      <li>
        <label class="checkable-line">
          <input type="checkbox" data-step-index="${idx}">
          <span>${step}</span>
        </label>
      </li>
    `
    )
    .join('');

  const cookModeHtml = cookMode.enabled
    ? `
    <div class="cook-mode" id="cookModeBox">
      <div class="cook-progress" id="cookProgress"></div>
      <div class="cook-step" id="cookStepText"></div>
      <div class="cook-controls">
        <button class="ghost-btn" id="cookPrevBtn">Previous</button>
        <button class="primary-btn" id="cookNextBtn">Next</button>
      </div>
    </div>
  `
    : '';

  recipeDetailEl.innerHTML = `
    <h2>${recipe.name}</h2>
    <div class="recipe-meta">
      <span>${recipe.category}</span> ·
      <span>${recipe.cookTime || 'Time not set'}</span> ·
      <span>Serves ${recipe.servings || '?'}</span>
    </div>
    <div class="tags">
      ${tagsHtml}
    </div>

    <div class="detail-actions">
      <button class="favourite-btn ${favActiveClass}" id="favBtn">
        ${favLabel}
      </button>
      <button class="ghost-btn" id="editRecipeBtn">Edit</button>
      <button class="danger-btn" id="deleteRecipeBtn">Delete</button>
      <button class="ghost-btn" id="toggleCookModeBtn">${
        cookMode.enabled ? 'Exit cook mode' : 'Cook mode'
      }</button>
    </div>

    ${cookModeHtml}

    <div class="section-header">
      <span class="section-header-title">Ingredients</span>
    </div>
    <ul class="ingredients-list">
      ${ingredientsHtml}
    </ul>

    <div class="section-header">
      <span class="section-header-title">Method</span>
    </div>
    <ol class="steps-list">
      ${stepsHtml}
    </ol>

    ${
      recipe.notes
        ? `<div class="section-header"><span class="section-header-title">Notes</span></div><p>${recipe.notes}</p>`
        : ''
    }
  `;

  // Wire up detail actions
  document.getElementById('favBtn').addEventListener('click', () =>
    toggleFavourite(recipe.id)
  );
  document.getElementById('editRecipeBtn').addEventListener('click', () =>
    openRecipeModal(recipe)
  );
  document.getElementById('deleteRecipeBtn').addEventListener('click', () =>
    openDeleteModal(recipe.id)
  );
  document
    .getElementById('toggleCookModeBtn')
    .addEventListener('click', toggleCookMode);

  // Checkbox interactions (strike-through)
  recipeDetailEl
    .querySelectorAll('.checkable-line input[type="checkbox"]')
    .forEach(cb => {
      cb.addEventListener('change', () => {
        const span = cb.nextElementSibling;
        if (!span) return;
        span.classList.toggle('checked', cb.checked);
      });
    });

  // Cook mode init if enabled
  if (cookMode.enabled) {
    initCookMode(recipe);
  }
}

// ----- Cook mode -----

function toggleCookMode() {
  cookMode.enabled = !cookMode.enabled;
  cookMode.currentStepIndex = 0;
  renderRecipeDetail();
}

function initCookMode(recipe) {
  const box = document.getElementById('cookModeBox');
  const progressEl = document.getElementById('cookProgress');
  const stepTextEl = document.getElementById('cookStepText');
  const prevBtn = document.getElementById('cookPrevBtn');
  const nextBtn = document.getElementById('cookNextBtn');

  if (!box) return;

  function update() {
    const total = recipe.steps.length;
    const index = cookMode.currentStepIndex;
    const stepNum = index + 1;
    progressEl.textContent = `Step ${stepNum} of ${total}`;
    stepTextEl.textContent = recipe.steps[index];

    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === total - 1 ? 'Finish' : 'Next';
  }

  prevBtn.addEventListener('click', () => {
    if (cookMode.currentStepIndex > 0) {
      cookMode.currentStepIndex--;
      update();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (cookMode.currentStepIndex < recipe.steps.length - 1) {
      cookMode.currentStepIndex++;
      update();
    } else {
      // Finished
      cookMode.enabled = false;
      cookMode.currentStepIndex = 0;
      renderRecipeDetail();
    }
  });

  update();
}

// ----- Modals -----

function openRecipeModal(recipe = null) {
  if (recipe) {
    recipeModalTitle.textContent = 'Edit recipe';
    recipeNameInput.value = recipe.name;
    recipeCategorySelect.value = recipe.category || '';
    recipeCookTimeInput.value = recipe.cookTime || '';
    recipeServingsInput.value = recipe.servings || 4;
    recipeTagsInput.value = (recipe.tags || []).join(', ');
    recipeIngredientsTextarea.value = (recipe.ingredients || []).join('\n');
    recipeStepsTextarea.value = (recipe.steps || []).join('\n');
    recipeNotesTextarea.value = recipe.notes || '';
    recipeIdHidden.value = recipe.id;
  } else {
    recipeModalTitle.textContent = 'Add recipe';
    recipeForm.reset();
    recipeServingsInput.value = 4;
    recipeIdHidden.value = '';
  }
  recipeModalBackdrop.classList.remove('hidden');
  recipeNameInput.focus();
}

function closeRecipeModal() {
  recipeModalBackdrop.classList.add('hidden');
}

function openDeleteModal(recipeId) {
  recipeIdToDelete = recipeId;
  confirmDeleteBackdrop.classList.remove('hidden');
}

function closeDeleteModal() {
  confirmDeleteBackdrop.classList.add('hidden');
  recipeIdToDelete = null;
}

// ----- Event wiring -----

// Search
searchInputEl.addEventListener('input', () => {
  renderRecipeList();
});

clearSearchBtn.addEventListener('click', () => {
  searchInputEl.value = '';
  renderRecipeList();
  searchInputEl.focus();
});

// Category chips
categoryChipsEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-category]');
  if (!btn) return;
  activeCategory = btn.dataset.category || '';

  categoryChipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', chip === btn);
  });

  renderRecipeList();
});

// Favourites
favouritesToggleEl.addEventListener('click', () => {
  showFavouritesOnly = !showFavouritesOnly;
  favouritesToggleEl.classList.toggle('active', showFavouritesOnly);
  favouritesToggleEl.textContent = showFavouritesOnly
    ? '⭐ Favourites only: On'
    : '⭐ Favourites only: Off';
  renderRecipeList();
});

// Random recipe
randomRecipeBtn.addEventListener('click', () => {
  const filtered = getFilteredRecipes();
  if (filtered.length === 0) return;
  const random = filtered[Math.floor(Math.random() * filtered.length)];
  currentRecipeId = random.id;
  cookMode.enabled = false;
  cookMode.currentStepIndex = 0;
  renderRecipeList();
  renderRecipeDetail();
});

// Add recipe
addRecipeBtn.addEventListener('click', () => openRecipeModal());

// Modal buttons
closeRecipeModalBtn.addEventListener('click', closeRecipeModal);
cancelRecipeBtn.addEventListener('click', closeRecipeModal);

recipeModalBackdrop.addEventListener('click', e => {
  if (e.target === recipeModalBackdrop) {
    closeRecipeModal();
  }
});

// Delete modal buttons
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
confirmDeleteBtn.addEventListener('click', () => {
  if (!recipeIdToDelete) return;
  recipes = recipes.filter(r => r.id !== recipeIdToDelete);
  saveRecipes(recipes);

  // Also remove from favourites
  favourites = favourites.filter(f => f !== recipeIdToDelete);
  saveFavourites(favourites);

  if (currentRecipeId === recipeIdToDelete) {
    currentRecipeId = recipes[0]?.id || null;
  }

  closeDeleteModal();
  renderRecipeList();
  renderRecipeDetail();
});

confirmDeleteBackdrop.addEventListener('click', e => {
  if (e.target === confirmDeleteBackdrop) {
    closeDeleteModal();
  }
});

// Form submit
recipeForm.addEventListener('submit', e => {
  e.preventDefault();

  const id = recipeIdHidden.value || generateId(recipeNameInput.value);
  const name = recipeNameInput.value.trim();
  const category = recipeCategorySelect.value;
  const cookTime = recipeCookTimeInput.value.trim();
  const servings = parseInt(recipeServingsInput.value, 10) || 0;
  const tags = recipeTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const ingredients = recipeIngredientsTextarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const steps = recipeStepsTextarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const notes = recipeNotesTextarea.value.trim();

  const existingIndex = recipes.findIndex(r => r.id === id);
  const recipeData = {
    id,
    name,
    category,
    cookTime,
    servings,
    tags,
    ingredients,
    steps,
    notes
  };

  if (existingIndex >= 0) {
    recipes[existingIndex] = recipeData;
  } else {
    recipes.push(recipeData);
  }

  saveRecipes(recipes);
  currentRecipeId = id;
  cookMode.enabled = false;
  cookMode.currentStepIndex = 0;
  closeRecipeModal();
  renderRecipeList();
  renderRecipeDetail();
});

// Keyboard shortcuts: Esc closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!recipeModalBackdrop.classList.contains('hidden')) closeRecipeModal();
    if (!confirmDeleteBackdrop.classList.contains('hidden')) closeDeleteModal();
  }
});

// ----- Initial render -----
renderRecipeList();
renderRecipeDetail();
