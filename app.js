// =========================
// HumGod McTwatch Recipes
// Shared via Firebase Realtime Database
// Recipes are shared, favourites are per-device
// =========================

// ----- Config & constants -----

const FAVS_STORAGE_KEY = 'familyRecipeFavourites_v1';
const SORT_MODE_ALPHA = 'alpha';
const SORT_MODE_RECENT = 'recent';

// Firebase refs (may not be ready if Firebase failed to load)
let db = null;
let auth = null;
let recipesRef = null;

if (window.firebase && firebase.apps && firebase.apps.length) {
  db = firebase.database();
  auth = firebase.auth();
  recipesRef = db.ref('recipes');
} else {
  console.error('Firebase not initialised – check index.html script order/config');
}

// ----- App state -----

let recipes = [];                     // comes from Firebase
let favourites = loadFavourites();    // local only
let currentRecipeId = null;
let activeCategory = '';
let showFavouritesOnly = false;
let sortMode = SORT_MODE_ALPHA;

let cookMode = {
  enabled: false,
  currentStepIndex: 0
};

let searchDebounceTimer = null;

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

// ----- Extra UI elements (sort + clear filters) -----

const statusRowEl = document.querySelector('.status-row');
const sortToggleBtn = document.createElement('button');
sortToggleBtn.className = 'toggle-btn';
sortToggleBtn.id = 'sortToggleBtn';
sortToggleBtn.textContent = 'Sort: A → Z';

const clearFiltersBtn = document.createElement('button');
clearFiltersBtn.className = 'ghost-btn';
clearFiltersBtn.id = 'clearFiltersBtn';
clearFiltersBtn.textContent = 'Clear filters';

if (statusRowEl) {
  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  statusRowEl.style.display = 'flex';
  statusRowEl.style.alignItems = 'center';
  statusRowEl.style.gap = '0.5rem';

  statusRowEl.appendChild(spacer);
  statusRowEl.appendChild(sortToggleBtn);
  statusRowEl.appendChild(clearFiltersBtn);
}

// ----- Local storage: favourites only -----

function loadFavourites() {
  try {
    const stored = localStorage.getItem(FAVS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavourites(list) {
  localStorage.setItem(FAVS_STORAGE_KEY, JSON.stringify(list));
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

// ----- Toast helper -----

let toastTimeoutId = null;

function showToast(message, type = 'info') {
  let toastEl = document.getElementById('hgmt-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'hgmt-toast';
    document.body.appendChild(toastEl);
  }

  const bg =
    type === 'error'
      ? 'rgba(255,77,77,0.95)'
      : type === 'success'
      ? 'rgba(80, 250, 123, 0.95)'
      : 'rgba(255,255,255,0.95)';
  const color = '#000';

  Object.assign(toastEl.style, {
    position: 'fixed',
    left: '50%',
    bottom: '1.5rem',
    transform: 'translateX(-50%)',
    padding: '0.6rem 1rem',
    borderRadius: '999px',
    fontSize: '0.85rem',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    background: bg,
    color,
    boxShadow: '0 12px 30px rgba(0,0,0,0.9)',
    zIndex: 1000,
    opacity: '1',
    transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
    pointerEvents: 'none',
    maxWidth: '80%',
    textAlign: 'center'
  });

  toastEl.textContent = message;

  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(-50%) translateY(6px)';
  }, 2200);
}

// ----- Utility -----

function generateId(name) {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'recipe';
  return base + '-' + Date.now().toString(36);
}

function initFirebaseSync() {
  if (!auth || !recipesRef) {
    console.warn('Skipping Firebase sync – auth/recipesRef not ready');
    return;
  }

  auth.onAuthStateChanged(user => {
    if (!user) {
      return;
    }

    recipesRef.on('value', snapshot => {
      const data = snapshot.val() || {};
      const list = Object.values(data);

      recipes = list;

      if (recipes.length === 0) {
        currentRecipeId = null;
      } else if (
        !currentRecipeId ||
        !recipes.find(r => r.id === currentRecipeId)
      ) {
        currentRecipeId = recipes[0].id;
      }

      renderRecipeList();
      renderRecipeDetail();
    });
  });
}

function saveRecipeToFirebase(recipe) {
  if (!recipesRef) {
    console.warn('Firebase not ready – recipe only in local state this session');
    return;
  }
  recipesRef.child(recipe.id).set(recipe, err => {
    if (err) {
      console.error('Error saving recipe:', err);
      showToast('Error saving recipe', 'error');
    } else {
      showToast('Recipe saved', 'success');
    }
  });
}

function deleteRecipeFromFirebase(id) {
  if (!recipesRef) {
    console.warn('Firebase not ready – delete only in local state this session');
    return;
  }
  recipesRef.child(id).remove(err => {
    if (err) {
      console.error('Error deleting recipe:', err);
      showToast('Error deleting recipe', 'error');
    } else {
      showToast('Recipe deleted', 'success');
    }
  });
}

// ----- Sorting + filtering -----

function sortRecipes(list) {
  const sorted = [...list];
  if (sortMode === SORT_MODE_ALPHA) {
    sorted.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base'
      })
    );
  } else if (sortMode === SORT_MODE_RECENT) {
    sorted.sort((a, b) => {
      const at = a._createdAt || 0;
      const bt = b._createdAt || 0;
      return bt - at;
    });
  }
  return sorted;
}

function getFilteredRecipes() {
  const term = searchInputEl.value.trim().toLowerCase();
  const filtered = recipes.filter(r => {
    if (activeCategory && r.category !== activeCategory) return false;
    if (showFavouritesOnly && !isFavourite(r.id)) return false;

    if (!term) return true;

    const inName = (r.name || '').toLowerCase().includes(term);
    const inTags = (r.tags || []).some(tag =>
      tag.toLowerCase().includes(term)
    );
    const inIngredients = (r.ingredients || []).some(ing =>
      ing.toLowerCase().includes(term)
    );

    return inName || inTags || inIngredients;
  });

  return sortRecipes(filtered);
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
      'No recipes yet. Click “+ Add recipe” to create your first one.';
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
    title.textContent = r.name || 'Untitled recipe';

    const meta = document.createElement('small');
    const favStar = isFavourite(r.id) ? '⭐ ' : '';
    meta.textContent = `${favStar}${r.category || 'Uncategorised'} • ${
      r.cookTime || 'Time n/a'
    } • Serves ${r.servings || '?'}`;

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    recipeListEl.appendChild(item);
  });
}

// ----- Rendering detail -----

function renderRecipeDetail() {
  const recipe = recipes.find(r => r.id === currentRecipeId);
  if (!recipe) {
    recipeDetailEl.innerHTML =
      '<p class="placeholder">No recipe selected. Add one to get started.</p>';
    return;
  }

  const favActiveClass = isFavourite(recipe.id) ? 'active' : '';
  const favLabel = isFavourite(recipe.id)
    ? '⭐ Favourite'
    : '☆ Mark as favourite';

  const tagsHtml = (recipe.tags || [])
    .map(tag => `<span class="tag">${tag}</span>`)
    .join('');

  const ingredientsHtml = (recipe.ingredients || [])
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

  const stepsHtml = (recipe.steps || [])
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

  const shareButtonHtml =
    navigator.share != null
      ? `<button class="ghost-btn" id="shareRecipeBtn">Share</button>`
      : '';

  const printButtonHtml = `<button class="ghost-btn" id="printRecipeBtn">Print</button>`;

  recipeDetailEl.innerHTML = `
    <h2>${recipe.name || 'Untitled recipe'}</h2>
    <div class="recipe-meta">
      <span>${recipe.category || 'Uncategorised'}</span> ·
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
      ${shareButtonHtml}
      ${printButtonHtml}
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

  // Buttons
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

  const printBtn = document.getElementById('printRecipeBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const shareBtn = document.getElementById('shareRecipeBtn');
  if (shareBtn && navigator.share) {
    shareBtn.addEventListener('click', () => {
      const textPieces = [];
      textPieces.push(recipe.name || 'Recipe');
      if (recipe.category) textPieces.push(recipe.category);
      if (recipe.cookTime) textPieces.push(`Time: ${recipe.cookTime}`);
      if (recipe.servings) textPieces.push(`Serves: ${recipe.servings}`);
      textPieces.push('\nIngredients:');
      (recipe.ingredients || []).forEach(i => textPieces.push(`• ${i}`));
      textPieces.push('\nMethod:');
      (recipe.steps || []).forEach((s, idx) =>
        textPieces.push(`${idx + 1}. ${s}`)
      );

      navigator
        .share({
          title: recipe.name || 'Recipe',
          text: textPieces.join('\n')
        })
        .catch(() => {});
    });
  }

  // Checkbox interactions
  recipeDetailEl
    .querySelectorAll('.checkable-line input[type="checkbox"]')
    .forEach(cb => {
      cb.addEventListener('change', () => {
        const span = cb.nextElementSibling;
        if (!span) return;
        span.classList.toggle('checked', cb.checked);
      });
    });

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
    const total = (recipe.steps || []).length || 1;
    const index = cookMode.currentStepIndex;
    const stepNum = index + 1;
    progressEl.textContent = `Step ${stepNum} of ${total}`;
    stepTextEl.textContent = recipe.steps[index] || 'No steps yet';

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
    const total = (recipe.steps || []).length || 1;
    if (cookMode.currentStepIndex < total - 1) {
      cookMode.currentStepIndex++;
      update();
    } else {
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
    recipeNameInput.value = recipe.name || '';
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

// Debounced search
searchInputEl.addEventListener('input', () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderRecipeList();
  }, 180);
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

// Favourites toggle
favouritesToggleEl.addEventListener('click', () => {
  showFavouritesOnly = !showFavouritesOnly;
  favouritesToggleEl.classList.toggle('active', showFavouritesOnly);
  favouritesToggleEl.textContent = showFavouritesOnly
    ? '⭐ Favourites only: On'
    : '⭐ Favourites only: Off';
  renderRecipeList();
});

// Sort toggle
sortToggleBtn.addEventListener('click', () => {
  sortMode = sortMode === SORT_MODE_ALPHA ? SORT_MODE_RECENT : SORT_MODE_ALPHA;
  sortToggleBtn.textContent =
    sortMode === SORT_MODE_ALPHA ? 'Sort: A → Z' : 'Sort: Newest';
  renderRecipeList();
});

// Clear filters
clearFiltersBtn.addEventListener('click', () => {
  activeCategory = '';
  showFavouritesOnly = false;
  searchInputEl.value = '';

  favouritesToggleEl.classList.remove('active');
  favouritesToggleEl.textContent = '⭐ Favourites only: Off';

  categoryChipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === '');
  });

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
  showToast('Random recipe selected');
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

  // Update local state for quick UI response
  recipes = recipes.filter(r => r.id !== recipeIdToDelete);
  favourites = favourites.filter(f => f !== recipeIdToDelete);
  saveFavourites(favourites);

  if (currentRecipeId === recipeIdToDelete) {
    currentRecipeId = recipes[0]?.id || null;
  }

  renderRecipeList();
  renderRecipeDetail();

  // Persist deletion in Firebase
  deleteRecipeFromFirebase(recipeIdToDelete);
  closeDeleteModal();
});

confirmDeleteBackdrop.addEventListener('click', e => {
  if (e.target === confirmDeleteBackdrop) {
    closeDeleteModal();
  }
});

// Form submit
recipeForm.addEventListener('submit', e => {
  e.preventDefault();

  const name = recipeNameInput.value.trim();
  if (!name) {
    showToast('Please enter a recipe name', 'error');
    recipeNameInput.focus();
    return;
  }

  const id = recipeIdHidden.value || generateId(name);
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
  const now = Date.now();

  const recipeData = {
    id,
    name,
    category,
    cookTime,
    servings,
    tags,
    ingredients,
    steps,
    notes,
    _createdAt:
      existingIndex >= 0
        ? recipes[existingIndex]._createdAt || now
        : now
  };

  if (existingIndex >= 0) {
    recipes[existingIndex] = recipeData;
  } else {
    recipes.push(recipeData);
  }

  currentRecipeId = id;
  cookMode.enabled = false;
  cookMode.currentStepIndex = 0;
  closeRecipeModal();
  renderRecipeList();
  renderRecipeDetail();

  // Persist to Firebase (this will then re-sync across all devices)
  saveRecipeToFirebase(recipeData);
});

// Keyboard shortcuts: Esc closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!recipeModalBackdrop.classList.contains('hidden')) closeRecipeModal();
    if (!confirmDeleteBackdrop.classList.contains('hidden')) closeDeleteModal();
  }
});

// ----- Start app -----

// Show placeholders until Firebase loads data
renderRecipeList();
renderRecipeDetail();
initFirebaseSync();
