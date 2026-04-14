import { useMemo } from 'react';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { GalleryTileBookingContent } from '@/components/GalleryTileBookingContent';
import { TileFieldsPanel } from '@/components/TileFieldsPanel';
import { ViewFiltersPanel } from '@/components/ViewFiltersPanel';
import { applyGalleryFilters } from '@/lib/galleryFilterPrefs';
import { defaultGalleryFilters } from '@/lib/galleryPrefsModel';

/**
 * @param {object} props
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} props.bookings
 * @param {Date} props.monthCursor — выбранный месяц/год из навигации (режимы «Месяц» / «Год»)
 * @param {any[] | undefined} props.fields
 * @param {(id: string) => void} props.onOpenBooking
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} props.clientUi
 * @param {(next: import('@/lib/galleryPrefsModel').ClientUiPayload | ((prev: import('@/lib/galleryPrefsModel').ClientUiPayload) => import('@/lib/galleryPrefsModel').ClientUiPayload)) => void} props.updateClientUi
 */
export function GalleryView({ bookings, monthCursor, fields, onOpenBooking, clientUi, updateClientUi }) {
  const prefs = clientUi.galleryFilters;
  const tileVisible = clientUi.galleryTileFieldVisible || {};

  /** @param {import('@/lib/galleryPrefsModel').GalleryFilterPrefs | ((p: import('@/lib/galleryPrefsModel').GalleryFilterPrefs) => import('@/lib/galleryPrefsModel').GalleryFilterPrefs)} nextOrFn */
  function setGalleryFilters(nextOrFn) {
    updateClientUi((prev) => ({
      ...prev,
      version: 1,
      galleryFilters:
        typeof nextOrFn === 'function' ? nextOrFn(prev.galleryFilters) : nextOrFn,
    }));
  }

  const filtered = useMemo(
    () => applyGalleryFilters(bookings, prefs, monthCursor),
    [bookings, prefs, monthCursor],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.timeRange || '').localeCompare(b.timeRange || '');
      }),
    [filtered],
  );

  const hasFilters =
    prefs.period !== 'all' ||
    prefs.statusIds.length > 0 ||
    prefs.sourceIds.length > 0 ||
    prefs.tagIds.length > 0 ||
    prefs.search.trim() !== '';

  function resetFilters() {
    updateClientUi((prev) => ({ ...prev, galleryFilters: defaultGalleryFilters() }));
  }

  return (
    <div className="space-y-4">
      <FloatingSidePanel
        open={clientUi.galleryTileFieldsPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, galleryTileFieldsPanelOpen: false }))}
        title="Поля карточки"
      >
        <TileFieldsPanel
          embedded
          fields={fields}
          tileVisible={tileVisible}
          title="Поля на плитке"
          description="Отметьте, какие свойства показывать на карточке. Порядок как в форме заказа."
          onToggleField={(fieldId, on) =>
            updateClientUi((prev) => ({
              ...prev,
              galleryTileFieldVisible: {
                ...(prev.galleryTileFieldVisible || {}),
                [fieldId]: on,
              },
            }))
          }
        />
      </FloatingSidePanel>

      <FloatingSidePanel
        open={clientUi.galleryFiltersPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, galleryFiltersPanelOpen: false }))}
        title="Фильтры"
      >
        <ViewFiltersPanel
          embedded
          prefs={prefs}
          setPrefs={setGalleryFilters}
          monthCursor={monthCursor}
          fields={fields}
          hidePeriod={false}
          hasFilters={hasFilters}
          onReset={resetFilters}
        />
      </FloatingSidePanel>

      {!sorted.length ? (
        <div className="rounded-lg sm:rounded-xl border border-dashed border-notion-border px-4 py-10 sm:p-12 text-center text-sm text-notion-muted">
          {bookings.length === 0
            ? 'Пока нет записей. Создайте новую через кнопку выше.'
            : hasFilters
              ? 'Нет записей по выбранным фильтрам. Измените фильтры или сбросьте их.'
              : 'Нет записей для отображения.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {sorted.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onOpenBooking(b.id)}
              className="text-left h-full flex flex-col rounded-lg sm:rounded-xl border border-notion-border bg-notion-surface p-3 sm:p-4 active:bg-notion-hover/40 hover:border-notion-muted/50 hover:bg-notion-hover/30 transition-all shadow-sm touch-manipulation"
            >
              <GalleryTileBookingContent
                booking={/** @type {Record<string, unknown>} */ (b)}
                fields={fields}
                galleryTileFieldVisible={tileVisible}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
