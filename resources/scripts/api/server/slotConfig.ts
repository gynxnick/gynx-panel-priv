import http from '@/api/http';

export interface SlotConfig {
    nest_id: number;
    excluded_by_nest: boolean;
    env_variable: string | null;
    variable_name: string | null;
    current_value: number | null;
    min: number;
    max: number;
    editable: boolean;
    reason: string | null;
}

export const getSlotConfig = async (uuid: string): Promise<SlotConfig> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/slot-config`);
    return data.data as SlotConfig;
};

export const updateSlotConfig = async (uuid: string, value: number): Promise<SlotConfig> => {
    const { data } = await http.patch(`/api/client/servers/${uuid}/slot-config`, { value });
    return data.data as SlotConfig;
};
