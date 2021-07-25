clc; clear;

% Step 1: Add noise
noise = 50
I = rgb2gray(imread('bikes.bmp'));
Noisy_Img = double(I);
[m, n] = size(I);
Noisy_Img = Noisy_Img + noise*randn(m,n); % Noise added is 50

% Step 2: Perform DWT2 and Edge Mapping
Edge_Map_Img = edge(Noisy_Img, 'sobel');
[~, ~, ~, cDiag] = dwt2(Noisy_Img,'sym4','mode','per');
Dilate_EM = imdilate(Edge_Map_Img, strel('square', 2));
Imp_Ed_Mp = imresize(Dilate_EM, 0.5);
chg_IEM = abs(1 - Imp_Ed_Mp); 

% Step 3: Matrix multiplication of HH and Dilated Image
result = chg_IEM.*cDiag;
init_val = mean(abs(result(:))) % Init value of noise
%[m,n] = size(result);
%init_val = (1/sqrt(m*n))*sqrt(sum(sum(result.*result)))

% A few notes;
% To reproduce our results, make use of the init_val on line 19. 
% Reasons for making use of mean instead of squared mean average, was to
% avoid additional computational costs and keep it simple.
% You can still go ahead and work with init_val on line 21.
% Mathematically, both approaches are correct.
% In your case, you will need to tune the polynomial regression parameters
% to adapt to the init_val on line 21. 

% Expected outcome
% noise = [10, 20, 30, 40, 50]
% init_val = [8.13, 14.96, 22.28, 29.92, 37.61]
% These results match the ones in Table III of the paper.