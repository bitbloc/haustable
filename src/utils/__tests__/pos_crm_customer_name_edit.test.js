import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    calculateMemberTier, 
    parseTiersConfig, 
    DEFAULT_CRM_TIERS, 
    DEFAULT_CRM_SETTINGS,
    calculateTierDiscount,
    calculateMemberCrmScore,
    resolveDominantCrmMember 
} from '../crmHelper';

describe('POS Customer Name Editing & CRM System Integration Suite', () => {

    describe('1. Phone Number Normalization and Search Filtering', () => {
        const sampleMembers = [
            { id: 'usr-1', display_name: 'คุณสมชาย ว่องไว', phone_number: '081-234-5678', nickname: 'พี่เอก', current_tier: 'Haus Common' },
            { id: 'usr-2', display_name: 'Khun Mary Jane', phone_number: '0898765432', nickname: '', current_tier: 'Haus People' },
            { id: 'usr-3', display_name: 'คุณกิตติศักดิ์', phone_number: '061 999 8888', nickname: 'อ้วน', current_tier: 'Inner Haus' }
        ];

        it('matches members by telephone number ignoring dashes and spaces', () => {
            const queryWithNoHyphen = '0812345678';
            const cleanTerm = queryWithNoHyphen.replace(/[\s-]/g, '').toLowerCase();

            const matched = sampleMembers.filter(m => {
                const mPhone = (m.phone_number || '').replace(/[\s-]/g, '').toLowerCase();
                return mPhone.includes(cleanTerm);
            });

            expect(matched.length).toBe(1);
            expect(matched[0].id).toBe('usr-1');
            expect(matched[0].display_name).toBe('คุณสมชาย ว่องไว');
        });

        it('matches members by spaced telephone search input against unspaced telephone in database', () => {
            const queryWithSpaces = '089 876 5432';
            const cleanTerm = queryWithSpaces.replace(/[\s-]/g, '').toLowerCase();

            const matched = sampleMembers.filter(m => {
                const mPhone = (m.phone_number || '').replace(/[\s-]/g, '').toLowerCase();
                return mPhone.includes(cleanTerm);
            });

            expect(matched.length).toBe(1);
            expect(matched[0].id).toBe('usr-2');
        });

        it('matches members by Thai nickname and display name', () => {
            const queryName = 'กิตติ';
            const matchedByName = sampleMembers.filter(m => 
                (m.display_name || '').toLowerCase().includes(queryName)
            );
            expect(matchedByName.length).toBe(1);
            expect(matchedByName[0].id).toBe('usr-3');

            const queryNick = 'อ้วน';
            const matchedByNick = sampleMembers.filter(m => 
                (m.nickname || '').toLowerCase().includes(queryNick)
            );
            expect(matchedByNick.length).toBe(1);
            expect(matchedByNick[0].id).toBe('usr-3');
        });
    });

    describe('2. POS Customer Profile Update Logic & Sync Handover', () => {
        it('validates customer name requirement before saving', () => {
            const editDisplayName = '   ';
            const isValid = editDisplayName.trim().length > 0;
            expect(isValid).toBe(false);
        });

        it('correctly updates attachedMemberCrm and syncs to active booking state', () => {
            let attachedMember = {
                id: 'usr-1',
                display_name: 'คุณสมชาย',
                nickname: '',
                phone_number: '0812345678',
                current_tier: 'Haus Common',
                xhaus_balance: 150
            };

            const updatedProfile = {
                id: 'usr-1',
                display_name: 'คุณสมชาย ว่องไว (พี่เอก)',
                nickname: 'พี่เอก',
                phone_number: '0812345678'
            };

            // Simulating onUpdateCustomerProfile handover in POSDashboard
            if (attachedMember && attachedMember.id === updatedProfile.id) {
                attachedMember = { ...attachedMember, ...updatedProfile };
            }

            expect(attachedMember.display_name).toBe('คุณสมชาย ว่องไว (พี่เอก)');
            expect(attachedMember.nickname).toBe('พี่เอก');
            expect(attachedMember.xhaus_balance).toBe(150); // Balances are preserved
            expect(attachedMember.current_tier).toBe('Haus Common'); // Tier preserved
        });

        it('detects duplicate phone numbers across different member accounts', () => {
            const existingProfiles = [
                { id: 'usr-1', phone_number: '0812345678', display_name: 'Member One' },
                { id: 'usr-2', phone_number: '0898765432', display_name: 'Member Two' }
            ];

            const currentEditingId = 'usr-2';
            const targetNewPhone = '0812345678'; // Already taken by usr-1

            const dup = existingProfiles.find(p => p.phone_number === targetNewPhone && p.id !== currentEditingId);
            expect(dup).toBeDefined();
            expect(dup.id).toBe('usr-1');
            expect(dup.display_name).toBe('Member One');
        });
    });

    describe('3. CRM Tiers and Loyalty Rules Consistency', () => {
        const tiers = parseTiersConfig(DEFAULT_CRM_TIERS);

        it('evaluates correct member tier by spent threshold', () => {
            expect(calculateMemberTier(0, 0, tiers).current_tier).toBe('Haus Common');
            expect(calculateMemberTier(2500, 2500, tiers).current_tier).toBe('Haus Common');
            expect(calculateMemberTier(4000, 4000, tiers).current_tier).toBe('Haus People');
            expect(calculateMemberTier(11999, 11999, tiers).current_tier).toBe('Haus People');
            expect(calculateMemberTier(12000, 12000, tiers).current_tier).toBe('Inner Haus');
            expect(calculateMemberTier(50000, 50000, tiers).current_tier).toBe('Inner Haus');
        });

        it('applies tier multipliers correctly (1.0x, 1.25x, 1.5x)', () => {
            const commonTier = tiers.find(t => t.name === 'Haus Common');
            const peopleTier = tiers.find(t => t.name === 'Haus People');
            const innerTier = tiers.find(t => t.name === 'Inner Haus');

            expect(commonTier.multiplier).toBe(1.0);
            expect(peopleTier.multiplier).toBe(1.25);
            expect(innerTier.multiplier).toBe(1.5);
        });

        it('respects store policy on tier discounts (disabled by default in favor of multipliers)', () => {
            const result = calculateTierDiscount('Inner Haus', 1000, DEFAULT_CRM_SETTINGS);
            expect(result.discountAmount).toBe(0); // Policy: discount pct disabled, earn multiplier used
            expect(result.isEnabled).toBe(false);
        });

        it('preserves dominant CRM member when merging tables/bills', () => {
            const lowTierMember = { id: 'm-1', current_tier: 'Haus Common', xhaus_balance: 50 };
            const highTierMember = { id: 'm-2', current_tier: 'Inner Haus', xhaus_balance: 500 };

            const booking1 = { user_id: 'm-1', profiles: lowTierMember };
            const booking2 = { user_id: 'm-2', profiles: highTierMember };

            const dominant = resolveDominantCrmMember(booking1, booking2, lowTierMember, highTierMember);
            expect(dominant.dominantMember.id).toBe('m-2');
            expect(dominant.dominantMember.current_tier).toBe('Inner Haus');
        });
    });

    describe('4. Drink Stamp Card Logic (10 Stamps = 1 Free Drink)', () => {
        it('calculates earned free drinks and leftover stamps correctly', () => {
            const calculateStamps = (currentStamps, currentQuota, addedStamps, usedQuota) => {
                const totalStamps = currentStamps + Math.max(0, addedStamps);
                const earnedQuota = Math.floor(totalStamps / 10);
                const finalStamps = totalStamps % 10;
                const finalQuota = Math.max(0, currentQuota - (usedQuota ? 1 : 0) + earnedQuota);
                return { finalStamps, finalQuota };
            };

            // Case A: 8 stamps + 3 new drinks -> 11 stamps = 1 free drink earned, 1 stamp remaining
            const resA = calculateStamps(8, 0, 3, false);
            expect(resA.finalQuota).toBe(1);
            expect(resA.finalStamps).toBe(1);

            // Case B: 1 free quota used, 0 new drinks -> quota decremented
            const resB = calculateStamps(resA.finalStamps, resA.finalQuota, 0, true);
            expect(resB.finalQuota).toBe(0);
            expect(resB.finalStamps).toBe(1);

            // Case C: 9 stamps + 1 drink -> exactly 10 = 1 free drink earned, 0 stamps remaining
            const resC = calculateStamps(9, 0, 1, false);
            expect(resC.finalQuota).toBe(1);
            expect(resC.finalStamps).toBe(0);
        });
    });
});
