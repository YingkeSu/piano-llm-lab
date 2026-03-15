<template>
  <div>
    <header class="top-nav">
      <div class="nav-brand">Piano-LLM-Lab Non-LLM</div>
      <nav>
        <RouterLink to="/" class="nav-link">Piano</RouterLink>
        <RouterLink to="/metronome" class="nav-link">Metronome</RouterLink>
      </nav>
    </header>

    <RouterView />
  </div>
</template>
