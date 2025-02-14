import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ItemEditForm } from '../ItemEditForm';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockStore = configureStore([]);
const queryClient = new QueryClient();

describe('ItemEditForm', () => {
    const mockItem = {
        id: 1,
        name: 'Test Item',
        description: 'Test Description',
        purchasePrice: 10,
        sellingPrice: 20,
        status: 'available' as const,
        qrCode: 'test-qr-code',
    };

    const mockContainers = [
        { id: 1, name: 'Container 1' },
        { id: 2, name: 'Container 2' },
    ];

    const mockCategories = [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' },
    ];

    const mockOnSuccess = jest.fn();
    const mockOnCancel = jest.fn();

    const store = mockStore({
        items: {
            items: [mockItem],
        },
    });

    const renderComponent = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <Provider store={store}>
                    <ItemEditForm
                        item={mockItem}
                        containers={mockContainers}
                        categories={mockCategories}
                        onSuccess={mockOnSuccess}
                        onCancel={mockOnCancel}
                    />
                </Provider>
            </QueryClientProvider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('affiche correctement les informations de l\'article', () => {
        const { getByPlaceholderText, getByText } = renderComponent();

        const nameInput = getByPlaceholderText('Nom de l\'article');
        const descriptionInput = getByPlaceholderText('Description de l\'article');

        expect(nameInput.props.value).toBe(mockItem.name);
        expect(descriptionInput.props.value).toBe(mockItem.description);
        expect(getByText('Prix d\'achat (€)')).toBeTruthy();
        expect(getByText('Prix de vente (€)')).toBeTruthy();
    });

    it('met à jour les valeurs lors de la modification', () => {
        const { getByPlaceholderText } = renderComponent();

        const nameInput = getByPlaceholderText('Nom de l\'article');
        fireEvent.changeText(nameInput, 'Nouveau nom');

        expect(nameInput.props.value).toBe('Nouveau nom');
    });

    it('affiche les conteneurs disponibles', () => {
        const { getByText } = renderComponent();

        mockContainers.forEach(container => {
            expect(getByText(container.name)).toBeTruthy();
        });
    });

    it('affiche les catégories disponibles', () => {
        const { getByText } = renderComponent();

        mockCategories.forEach(category => {
            expect(getByText(category.name)).toBeTruthy();
        });
    });

    it('appelle onCancel lors du clic sur Annuler', () => {
        const { getByText } = renderComponent();

        fireEvent.press(getByText('Annuler'));
        expect(mockOnCancel).toHaveBeenCalled();
    });

    it('valide les prix avant la mise à jour', async () => {
        const { getByText, getByPlaceholderText } = renderComponent();

        const purchasePriceInput = getByPlaceholderText('0.00');
        fireEvent.changeText(purchasePriceInput, 'invalid');

        const updateButton = getByText('Mettre à jour');
        fireEvent.press(updateButton);

        await waitFor(() => {
            expect(mockOnSuccess).not.toHaveBeenCalled();
        });
    });
}); 