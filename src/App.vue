<script setup lang="ts">
import './global.scss';
import { onMounted } from 'vue';

import Navbar from './components/Navbar/Navbar.vue';
import Hero from './components/Hero/Hero.vue';
import About from './components/About/About.vue';
import Woltek from './components/Woltek/Woltek.vue';
import Activity from './components/Activity/Activity.vue';
import Stack from './components/Stack/Stack.vue';
import Projects from './components/Projects/Projects.vue';
import Experience from './components/Experience/Experience.vue';
import Arcade from './components/Arcade/Arcade.vue';
import Contact from './components/Contact/Contact.vue';
import Footer from './components/Footer/Footer.vue';
import { setupCounters, setupReveals } from './motion';

onMounted(() => {
    setupReveals();
    setupCounters();
});
</script>

<template>
    <Navbar />
    <main>
        <Hero />
        <About />
        <Woltek />
        <Activity />
        <Stack />
        <Projects />
        <Experience />
        <Arcade />
        <Contact />
    </main>
    <Footer />
</template>
