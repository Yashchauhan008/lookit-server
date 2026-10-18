export const POSTGRES_ERROR_CODES = {
    23505: {
        httpStatusCode: 400,
        code: 'duplicate_key_value',
        message: 'Value already exists',

        constraint: {
            uk_cities_district_id_name: 'City name already exists with same name in this district',
            uk_devices_imei_number: 'Device with same IMEI number already exists',
            uk_districts_name: 'District name already exists',
            uk_permissions_code: 'Permission code already exists',
            uk_roles_name: 'Role name already exists',
            uk_sim_cards_imsi_number: 'SIM card with same IMSI number already exists',
            uk_sim_cards_number: 'SIM card with same number already exists',
            uk_sim_plans_name: 'SIM plan with same name already exists',
            uk_users_email: 'User with same email already exists',
            uk_users_phone_number: 'User with same phone number already exists',
            uk_wards_zone_id_name: 'Ward name already exists with same name in this zone',
            uk_zones_fire_station_id_name: 'Zone name already exists with same name in this fire station',
            uk_devices_sim_card_id: 'Device with same SIM card already exists',
            uk_calibrations_device_id_io_element_label: 'Calibration already exists for this device and IO element label',
            uk_dealers_pan_number: 'Dealer with same PAN number already exists',
            uk_dealers_email: 'Dealer with same email already exists',
            uk_dealers_phone_number: 'Dealer with same phone number already exists',
            uk_dealers_promo_code: 'Dealer with same promo code already exists',
        },
    },

    23514: {
        httpStatusCode: 400,
        code: 'check_constraint_violation',
        message: 'Check constraint violation',

        constraint: {
            cc_devices_number_of_floors: 'Number of floors must be greater than 0',
            cc_devices_number_of_blocks: 'Number of blocks must be greater than 0',
            cc_devices_latitude: 'Latitude must be between -90 and 90 degrees',
            cc_devices_longitude: 'Longitude must be between -180 and 180 degrees',
        },
    },

    23503: {
        httpStatusCode: 400,
        code: 'foreign_key_violation',
        message: 'Foreign key violation',

        constraint: {
            fk_cities_district_id: 'District not found',
            fk_device_logs_device_id: 'Device not found',
            fk_devices_created_by: 'User not found',
            fk_devices_sim_card_id: 'SIM card not found',
            fk_devices_updated_by: 'User not found',
            fk_devices_ward_id: 'Ward not found',
            fk_role_permissions_permission_id: 'Permission not found',
            fk_role_permissions_role_id: 'Role not found',
            fk_sim_cards_created_by: 'User not found',
            fk_sim_cards_sim_plan_id: 'SIM plan not found',
            fk_sim_cards_updated_by: 'User not found',
            fk_sim_plans_created_by: 'User not found',
            fk_sim_plans_updated_by: 'User not found',
            fk_user_device_mapping_device_id: 'Device not found',
            fk_user_device_mapping_user_id: 'User not found',
            fk_user_sessions_user_id: 'User not found',
            fk_users_roles_role_id: 'Role not found',
            fk_users_roles_user_id: 'User not found',
            fk_wards_zone_id: 'Zone is link with other records',
            fk_zones_fire_station_id: 'Fire station not found',
            fk_calibrations_device_id: 'Device not found',
        },
    },
};

