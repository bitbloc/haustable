-- Create a stored procedure (RPC) to handle recipe saving atomically
-- This bypasses RLS issues if we define it as SECURITY DEFINER (runs as owner)

CREATE OR REPLACE FUNCTION save_menu_recipe(
    p_menu_id BIGINT,
    p_ingredients JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (usually postgres/admin)
AS $$
DECLARE
    item JSONB;
    v_count INT := 0;
BEGIN
    -- 1. Delete existing ingredients for this menu
    DELETE FROM recipe_ingredients 
    WHERE parent_menu_item_id = p_menu_id;

    -- 2. Insert new ingredients
    IF jsonb_array_length(p_ingredients) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO recipe_ingredients (
                parent_menu_item_id,
                ingredient_id,
                quantity,
                unit,
                layer_order
            ) VALUES (
                p_menu_id,
                (item->>'ingredient_id')::BIGINT,
                (item->>'quantity')::NUMERIC,
                (item->>'unit')::TEXT,
                (item->>'layer_order')::INT
            );
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'count', v_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
