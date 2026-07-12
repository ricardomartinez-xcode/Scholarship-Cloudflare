-- Refresh PostgREST metadata after exposing recalc_admin and adding its tables.
NOTIFY pgrst, 'reload schema';
