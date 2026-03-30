/**
 * KAIROS Lab — Virtual Office V5
 * Smart swipe gesture navigation
 * Detects scrollable zones (filters, calendar) vs tab navigation
 */

const MIN_SWIPE_DIST = 60;

export function initSwipe(tabOrder, switchViewFn, changeMonthFn) {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        // Only horizontal swipes: deltaX must dominate deltaY
        if (Math.abs(deltaX) < MIN_SWIPE_DIST) return;
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

        const startEl = document.elementFromPoint(startX, startY);
        if (!startEl) return;

        // 1) Calendar grid → change month
        const calGrid = document.getElementById('calendarGrid');
        if (calGrid && calGrid.contains(startEl)) {
            changeMonthFn(deltaX < 0 ? 1 : -1);
            return;
        }

        // 2) Scrollable filter zones → let native scroll handle it, don't change tab
        const scrollableParent = startEl.closest(
            '.projects-filters, .tasks-view-filters, .library-header, .lists-filters, .nav-tabs'
        );
        if (scrollableParent && scrollableParent.scrollWidth > scrollableParent.clientWidth) {
            // Container has overflow — this swipe is for scrolling filters, not tabs
            return;
        }

        // 3) Assistant panel → ignore swipes inside Kaira chat
        if (startEl.closest('#assistantPanel')) return;

        // 4) Tab navigation
        const activeTab = document.querySelector('.nav-tab.active');
        if (!activeTab) return;
        const currentId = activeTab.dataset.view;
        const idx = tabOrder.indexOf(currentId);
        if (idx === -1) return;

        const newIdx = deltaX < 0 ? idx + 1 : idx - 1;
        if (newIdx >= 0 && newIdx < tabOrder.length) {
            switchViewFn(tabOrder[newIdx], deltaX < 0 ? 'left' : 'right');
        }
    }, { passive: true });
}
